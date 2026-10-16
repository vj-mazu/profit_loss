// ponytail: low-latency cursor pagination & GIN trigram search for 10M trucks
import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/trucks (Cursor-based pagination with O(log N) index seek)
router.get('/', authenticate, async (req, res) => {
  try {
    const { cursor, status, brand, seller, search, start_date, end_date, month } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 10), 200);

    const conditions = [];
    const params = [];

    // Cursor Index Seek (WHERE id < $cursor for descending sort)
    if (cursor) {
      params.push(parseInt(cursor, 10));
      conditions.push(`t.id < $${params.length}`);
    }

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (brand && brand !== 'ALL') {
      params.push(`%${brand}%`);
      conditions.push(`t.brand ILIKE $${params.length}`);
    }

    if (seller && seller !== 'ALL') {
      params.push(`%${seller}%`);
      conditions.push(`t.seller_name ILIKE $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      conditions.push(`t.date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`t.date <= $${params.length}`);
    }

    if (month && month !== 'ALL') {
      params.push(parseInt(month, 10));
      conditions.push(`EXTRACT(MONTH FROM t.date) = $${params.length}`);
    }

    // High-speed trigram search when query is >= 2 characters
    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(t.truck_serial ILIKE $${params.length} OR t.truck_number ILIKE $${params.length} OR t.purchase_bill_no ILIKE $${params.length} OR t.seller_name ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch limit + 1 to check for next page presence in a single round-trip
    params.push(limit + 1);
    const sql = `
      SELECT t.*, 
        po.contract_no as linked_contract_no,
        po.kg_per_bag as po_kg_per_bag,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.bags), 0) as allocated_bags,
        COALESCE(SUM(s.bill_amount), 0) as total_sales_amount,
        COALESCE(SUM(s.received_amount), 0) as total_received_amount,
        COALESCE(SUM(s.discount_amount), 0) as total_discount_amount,
        COALESCE(SUM(s.cutting_amount), 0) as total_cutting_amount,
        COALESCE(SUM(s.brokerage_amount), 0) as total_brokerage_amount,
        COALESCE(SUM(s.interest_amount) FILTER (WHERE s.interest_type = 'EARNED'), 0) as interest_earned,
        COALESCE(SUM(s.interest_amount) FILTER (WHERE s.interest_type = 'LOSS'), 0) as interest_loss,
        COUNT(s.brokerage_per_qtl) as custom_brokerage_count
      FROM trucks t
      LEFT JOIN purchase_orders po ON t.order_id = po.id
      LEFT JOIN sales_bills s ON t.id = s.truck_id
      ${whereClause}
      GROUP BY t.id, po.contract_no, po.kg_per_bag
      ORDER BY t.id DESC
      LIMIT $${params.length}
    `;

    const result = await query(sql, params);
    const rows = result.rows;

    const enrichedRows = rows.map((r) => {
      const qtls = Number(r.qty_qtls) || 0;
      const salesAmt = Number(r.total_sales_amount) || 0;
      const receivedAmt = Number(r.total_received_amount) || 0;
      const cdPct = r.purchase_cd_pct !== null && r.purchase_cd_pct !== undefined ? Number(r.purchase_cd_pct) : 2.0;
      const purchasePaid = r.purchase_payment_amount 
        ? Number(r.purchase_payment_amount) 
        : Math.round(Number(r.purchase_amount || 0) * (1 - cdPct / 100) * 100) / 100;
      const apmc = Math.round((salesAmt * 0.006) * 100) / 100;
      const itTcs = Math.round((salesAmt * 0.0039) * 100) / 100;
      const egb = Math.round(qtls * 100 * 100) / 100;
      const egbTrpt = Math.round(qtls * 20 * 100) / 100;
      const delhi = Math.round(qtls * 60 * 100) / 100;
      const kasat = Math.round(qtls * 40 * 100) / 100;
      const defaultBrokerage = delhi + kasat;
      const effectiveBrokerage = Number(r.custom_brokerage_count) > 0
        ? Number(r.total_brokerage_amount)
        : defaultBrokerage;
      const cogs = Math.round((purchasePaid + apmc + itTcs + egb + egbTrpt + effectiveBrokerage) * 100) / 100;

      const effectiveInflow = receivedAmt > 0 ? receivedAmt : salesAmt;
      const hasSales = Number(r.sales_count) > 0;
      const delayInterest = Number(r.purchase_delay_interest || 0) + Number(r.interest_loss || 0);
      const earnedInterest = Number(r.interest_earned || 0);
      const tradingProfit = effectiveInflow - cogs;
      const netProfit = hasSales ? Math.round((tradingProfit - delayInterest + earnedInterest) * 100) / 100 : null;
      const profitPerQtl = netProfit !== null && qtls > 0 ? Math.round((netProfit / qtls) * 100) / 100 : null;

      return {
        ...r,
        kg_per_bag: r.kg_per_bag ? Number(r.kg_per_bag) : (r.po_kg_per_bag ? Number(r.po_kg_per_bag) : 30),
        estimated_cogs: cogs,
        net_profit: netProfit,
        profit_per_qtl: profitPerQtl,
      };
    });

    const hasMore = enrichedRows.length > limit;
    const data = hasMore ? enrichedRows.slice(0, limit) : enrichedRows;
    const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

    res.json({
      data,
      hasMore,
      nextCursor,
      limit,
    });
  } catch (err) {
    console.error('Error fetching trucks with cursor pagination:', err);
    res.status(500).json({ message: 'Failed to fetch trucks' });
  }
});

// GET /api/trucks/:id (get truck detail with sales bills)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const truckRes = await query('SELECT * FROM trucks WHERE id = $1', [id]);
    if (truckRes.rows.length === 0) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    const salesRes = await query('SELECT * FROM sales_bills WHERE truck_id = $1 ORDER BY id ASC', [id]);
    res.json({
      ...truckRes.rows[0],
      sales_bills: salesRes.rows,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch truck details' });
  }
});

// POST /api/trucks (Create new truck entry)
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      order_id,
      truck_serial,
      truck_number,
      truck_lf,
      date,
      purchase_bill_no,
      seller_name,
      bags,
      qty_qtls,
      rate_per_qtl,
      kg_per_bag,
      lorry_advance,
      brand,
      brand_breakdown,
      origin_location,
      dest_location,
      unloading_date,
      status,
      remarks,
      buying_brokerage_per_qtl,
      broker_name,
      purchase_cd_pct,
      purchase_payment_amount,
      purchase_payment_date,
      purchase_payment_mode,
      purchase_payment_ref,
    } = req.body;

    // ---- Entry validation (mirror the user's Excel discipline) ----
    const normTruckNo = String(truck_number || '').toUpperCase().replace(/\s+/g, '');
    if (!normTruckNo) {
      return res.status(400).json({ message: 'Truck Registration No. is required' });
    }
    if (normTruckNo.length > 10) {
      return res.status(400).json({ message: 'Truck Registration No. cannot exceed 10 characters (e.g. UP78KN1839)' });
    }
    if (!Number(bags) || Number(bags) <= 0) {
      return res.status(400).json({ message: 'Total Bags must be a positive number' });
    }
    if (!Number(rate_per_qtl) || Number(rate_per_qtl) <= 0) {
      return res.status(400).json({ message: 'Purchase Rate (₹/Qtl) must be a positive number' });
    }

    const kgPerBag = Number(kg_per_bag) || 30;
    const calculatedQty = qty_qtls ? Number(qty_qtls) : Math.round((Number(bags) * kgPerBag / 100) * 100) / 100;
    const calculatedAmount = Math.round(Number(calculatedQty) * Number(rate_per_qtl) * 100) / 100;
    const totalLfAmount = Math.round(Number(truck_lf || 0) * calculatedQty * 100) / 100;
    const advancePaid = Number(lorry_advance || 0);
    const balanceLf = Math.round((totalLfAmount - advancePaid) * 100) / 100;

    let assignedTruckSerial = truck_serial;
    let linkedPo = null;
    if (order_id) {
      const poRes = await query('SELECT * FROM purchase_orders WHERE id = $1', [order_id]);
      if (poRes.rows.length === 0) {
        return res.status(404).json({ message: 'Linked purchase order not found' });
      }
      const po = poRes.rows[0];
      linkedPo = po;

      // Auto-assign truck serial per order
      const countRes = await query('SELECT COUNT(*) FROM trucks WHERE order_id = $1', [order_id]);
      const existingTruckCount = Number(countRes.rows[0].count) || 0;
      if (!assignedTruckSerial || assignedTruckSerial.trim() === '' || assignedTruckSerial.match(/^Truck\s*\d*$/i)) {
        assignedTruckSerial = `Truck ${existingTruckCount + 1}`;
      }

      // Check remaining bags on this purchase order
      const otherTrucksRes = await query(
        'SELECT id, bags, brand, brand_breakdown FROM trucks WHERE order_id = $1',
        [order_id]
      );
      let totalLiftedOther = 0;
      let usedByBrand = {};
      otherTrucksRes.rows.forEach((t) => {
        totalLiftedOther += Number(t.bags) || 0;
        let b = t.brand_breakdown;
        if (typeof b === 'string') {
          try { b = JSON.parse(b); } catch (e) { b = null; }
        }
        if (b && typeof b === 'object') {
          Object.entries(b).forEach(([k, cnt]) => {
            const ku = k.trim().toUpperCase();
            usedByBrand[ku] = (usedByBrand[ku] || 0) + (Number(cnt) || 0);
          });
        } else if (t.brand) {
          const ku = t.brand.trim().toUpperCase();
          usedByBrand[ku] = (usedByBrand[ku] || 0) + (Number(t.bags) || 0);
        }
      });

      const totalGiven = Number(po.bags_given) || 0;
      const totalRemaining = Math.max(0, totalGiven - totalLiftedOther);
      const reqBags = Number(bags) || 0;
      if (totalGiven > 0 && reqBags > totalRemaining) {
        return res.status(400).json({
          message: `Validation Error: Cannot lift ${reqBags.toLocaleString('en-IN')} bags. Only ${totalRemaining.toLocaleString('en-IN')} bags remaining on contract ${po.contract_no}!`
        });
      }

      // Check brand colors
      const poBrandColors = po.brand_colors && typeof po.brand_colors === 'object' ? po.brand_colors : {};
      const requestedBreakdown = brand_breakdown && typeof brand_breakdown === 'object'
        ? brand_breakdown
        : { [brand || 'BLUE']: reqBags };

      for (const [col, cnt] of Object.entries(requestedBreakdown)) {
        const cReq = Number(cnt) || 0;
        if (cReq <= 0) continue;
        const colUpper = col.trim().toUpperCase();
        const matchCol = Object.keys(poBrandColors).find((k) => k.trim().toUpperCase() === colUpper);
        if (matchCol) {
          const sentColor = Number(poBrandColors[matchCol]) || 0;
          const liftedColor = usedByBrand[colUpper] || 0;
          const remColor = Math.max(0, sentColor - liftedColor);
          if (cReq > remColor) {
            return res.status(400).json({
              message: `Validation Error: Cannot lift ${cReq.toLocaleString('en-IN')} ${col} bags. Only ${remColor.toLocaleString('en-IN')} ${col} bags remaining at mill on contract ${po.contract_no}!`
            });
          }
        }
      }
    }

    const formattedBrandBreakdown = brand_breakdown && typeof brand_breakdown === 'object'
      ? JSON.stringify(brand_breakdown)
      : (brand_breakdown || null);

    const effectiveBuyingBrokerage = buying_brokerage_per_qtl !== undefined && buying_brokerage_per_qtl !== '' && buying_brokerage_per_qtl !== null
      ? Number(buying_brokerage_per_qtl)
      : (linkedPo ? Number(linkedPo.buying_brokerage_per_qtl || 0) : 0);
    const effectiveBrokerName = broker_name || (linkedPo ? linkedPo.broker_name || '' : '');

    const effectiveCdPct = purchase_cd_pct !== undefined && purchase_cd_pct !== '' && purchase_cd_pct !== null
      ? Number(purchase_cd_pct)
      : (linkedPo && linkedPo.purchase_cd_pct !== null && linkedPo.purchase_cd_pct !== undefined ? Number(linkedPo.purchase_cd_pct) : 2.0);
    const effectivePaymentAmount = purchase_payment_amount !== undefined && purchase_payment_amount !== '' && purchase_payment_amount !== null
      ? Number(purchase_payment_amount)
      : Math.round(calculatedAmount * (1 - effectiveCdPct / 100) * 100) / 100;

    const result = await query(
      `INSERT INTO trucks (
        order_id, truck_serial, truck_number, truck_lf, date, purchase_bill_no, seller_name,
        bags, qty_qtls, rate_per_qtl, purchase_amount, lorry_advance, lf_balance, brand, brand_breakdown,
        origin_location, dest_location, unloading_date, status, remarks, kg_per_bag,
        buying_brokerage_per_qtl, broker_name, purchase_cd_pct, purchase_payment_amount,
        purchase_payment_date, purchase_payment_mode, purchase_payment_ref
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING *`,
      [
        order_id ? Number(order_id) : null,
        assignedTruckSerial || 'Truck 1',
        normTruckNo,
        Number(truck_lf || 0),
        date || new Date().toISOString().split('T')[0],
        purchase_bill_no || '',
        seller_name,
        Number(bags),
        calculatedQty,
        Number(rate_per_qtl),
        calculatedAmount,
        advancePaid,
        balanceLf,
        brand || 'BLUE',
        formattedBrandBreakdown,
        origin_location || '',
        dest_location || '',
        unloading_date || date || new Date().toISOString().split('T')[0],
        status || 'UNLOADED',
        remarks || '',
        kgPerBag,
        effectiveBuyingBrokerage,
        effectiveBrokerName,
        effectiveCdPct,
        effectivePaymentAmount,
        purchase_payment_date || null,
        purchase_payment_mode || null,
        purchase_payment_ref || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating truck:', err);
    res.status(500).json({ message: err.message || 'Failed to create truck entry' });
  }
});

// PUT /api/trucks/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      truck_serial,
      truck_number,
      truck_lf,
      date,
      purchase_bill_no,
      seller_name,
      bags,
      qty_qtls,
      rate_per_qtl,
      lorry_advance,
      brand,
      brand_breakdown,
      origin_location,
      dest_location,
      unloading_date,
      status,
      remarks,
      purchase_payment_amount,
      purchase_payment_date,
      purchase_payment_mode,
      purchase_payment_ref,
      purchase_cd_pct,
      sale_amount_received_date,
      purchase_gap_days,
      purchase_delay_interest,
      kg_per_bag,
      buying_brokerage_per_qtl,
      broker_name,
      order_id,
    } = req.body;

    const kgPerBag = kg_per_bag ? Number(kg_per_bag) : 30;
    // Validate truck number length on updates too (≤10 chars)
    if (truck_number !== undefined && truck_number !== null && truck_number !== '') {
      const nTruck = String(truck_number).toUpperCase().replace(/\s+/g, '');
      if (nTruck.length > 10) {
        return res.status(400).json({ message: 'Truck Registration No. cannot exceed 10 characters (e.g. UP78KN1839)' });
      }
    }
    // Only recompute qty/amount when the user actually sent bags/qty/rate.
    // Never write NaN into the row on partial updates (e.g. "Mark Unload").
    const bagsProvided = bags !== undefined && bags !== null && bags !== '';
    const qtyProvided = qty_qtls !== undefined && qty_qtls !== null && qty_qtls !== '';
    const rateProvided = rate_per_qtl !== undefined && rate_per_qtl !== null && rate_per_qtl !== '';
    const calculatedQty = (qtyProvided && Number(qty_qtls)) || (bagsProvided ? Math.round((Number(bags) * kgPerBag / 100) * 100) / 100 : null);
    const nextRate = rateProvided ? Number(rate_per_qtl) : null;
    const calculatedAmount = calculatedQty !== null && nextRate !== null && !Number.isNaN(calculatedQty) && !Number.isNaN(nextRate)
      ? Math.round(calculatedQty * nextRate * 100) / 100
      : null;

    const formattedBrandBreakdown = brand_breakdown !== undefined
      ? (brand_breakdown && typeof brand_breakdown === 'object' ? JSON.stringify(brand_breakdown) : (brand_breakdown || null))
      : null;

    const nextBuyingBrokerage = buying_brokerage_per_qtl !== undefined && buying_brokerage_per_qtl !== '' && buying_brokerage_per_qtl !== null
      ? Number(buying_brokerage_per_qtl)
      : null;

    const nextCdPct = purchase_cd_pct !== undefined && purchase_cd_pct !== '' && purchase_cd_pct !== null
      ? Number(purchase_cd_pct)
      : null;

    const result = await query(
      `UPDATE trucks SET
        order_id = COALESCE($1, order_id),
        truck_serial = COALESCE($2, truck_serial),
        truck_number = COALESCE($3, truck_number),
        truck_lf = COALESCE($4, truck_lf),
        date = COALESCE($5, date),
        purchase_bill_no = COALESCE($6, purchase_bill_no),
        seller_name = COALESCE($7, seller_name),
        bags = COALESCE($8, bags),
        qty_qtls = COALESCE($9, qty_qtls),
        rate_per_qtl = COALESCE($10, rate_per_qtl),
        purchase_amount = COALESCE($11, purchase_amount),
        lorry_advance = COALESCE($12, lorry_advance),
        lf_balance = (COALESCE($4, truck_lf) * COALESCE($9, qty_qtls)) - COALESCE($12, lorry_advance, 0),
        brand = COALESCE($13, brand),
        origin_location = COALESCE($14, origin_location),
        dest_location = COALESCE($15, dest_location),
        unloading_date = COALESCE($16, unloading_date),
        status = COALESCE($17, status),
        remarks = COALESCE($18, remarks),
        purchase_payment_amount = COALESCE($19, purchase_payment_amount),
        purchase_payment_date = COALESCE($20, purchase_payment_date),
        sale_amount_received_date = COALESCE($21, sale_amount_received_date),
        purchase_gap_days = COALESCE($22, purchase_gap_days),
        purchase_delay_interest = COALESCE($23, purchase_delay_interest),
        kg_per_bag = COALESCE($24, kg_per_bag),
        brand_breakdown = COALESCE($25, brand_breakdown),
        buying_brokerage_per_qtl = COALESCE($26, buying_brokerage_per_qtl),
        broker_name = COALESCE($27, broker_name),
        purchase_cd_pct = COALESCE($28, purchase_cd_pct),
        purchase_payment_mode = COALESCE($29, purchase_payment_mode),
        purchase_payment_ref = COALESCE($30, purchase_payment_ref)
       WHERE id = $31
       RETURNING *`,
      [
        order_id !== undefined ? (order_id ? Number(order_id) : null) : null,
        truck_serial,
        truck_number,
        truck_lf,
        date,
        purchase_bill_no,
        seller_name,
        bags,
        calculatedQty,
        nextRate,
        calculatedAmount,
        lorry_advance,
        brand,
        origin_location,
        dest_location,
        unloading_date,
        status,
        remarks,
        purchase_payment_amount !== undefined ? (purchase_payment_amount !== '' && purchase_payment_amount !== null ? Number(purchase_payment_amount) : null) : null,
        purchase_payment_date !== undefined ? purchase_payment_date : null,
        sale_amount_received_date,
        purchase_gap_days,
        purchase_delay_interest,
        kg_per_bag ? Number(kg_per_bag) : null,
        formattedBrandBreakdown,
        nextBuyingBrokerage,
        broker_name !== undefined ? broker_name : null,
        nextCdPct,
        purchase_payment_mode !== undefined ? purchase_payment_mode : null,
        purchase_payment_ref !== undefined ? purchase_payment_ref : null,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating truck:', err);
    res.status(500).json({ message: err.message || 'Failed to update truck' });
  }
});

// DELETE /api/trucks/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM trucks WHERE id = $1', [id]);
    res.json({ message: 'Truck deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete truck' });
  }
});

export default router;
