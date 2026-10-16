// ponytail: low-latency cursor pagination & GIN trigram search for 10M sales bills
import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { calculateBillFinancials, calculateFloatInterest, calculateMultiPaymentInterest } from '../utils/calculations.js';

const router = Router();

// GET /api/sales (Cursor-based pagination with O(log N) index seek)
router.get('/', authenticate, async (req, res) => {
  try {
    const { cursor, status, party, truck_id, search, start_date, end_date, month } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 10), 200);

    const conditions = [];
    const params = [];

    // Cursor seek: WHERE s.id < $cursor
    if (cursor) {
      params.push(parseInt(cursor, 10));
      conditions.push(`s.id < $${params.length}`);
    }

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`s.payment_status = $${params.length}`);
    }

    if (party && party !== 'ALL') {
      params.push(`%${party}%`);
      conditions.push(`s.party_name ILIKE $${params.length}`);
    }

    if (truck_id && truck_id !== 'ALL') {
      params.push(parseInt(truck_id, 10));
      conditions.push(`s.truck_id = $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      conditions.push(`s.date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`s.date <= $${params.length}`);
    }

    if (month && month !== 'ALL') {
      params.push(parseInt(month, 10));
      conditions.push(`EXTRACT(MONTH FROM s.date) = $${params.length}`);
    }

    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(s.sale_bill_no ILIKE $${params.length} OR s.party_name ILIKE $${params.length} OR t.truck_number ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit + 1);
    const sql = `
      SELECT s.*, 
        t.truck_serial, t.truck_number, t.brand, t.purchase_payment_date, t.purchase_amount
      FROM sales_bills s
      JOIN trucks t ON s.truck_id = t.id
      ${whereClause}
      ORDER BY s.id DESC
      LIMIT $${params.length}
    `;

    const result = await query(sql, params);
    const rows = result.rows;

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

    res.json({
      data,
      hasMore,
      nextCursor,
      limit,
    });
  } catch (err) {
    console.error('Error fetching sales bills with cursor pagination:', err);
    res.status(500).json({ message: 'Failed to fetch sales bills' });
  }
});

// POST /api/sales
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      truck_id,
      sale_bill_no,
      party_name,
      bags,
      qty_qtls,
      actual_rate,
      billing_rate,
      lf_rate,
      lorry_advance,
      brokerage_per_qtl,
      received_amount,
      disc_pct,
      discount_amount,
      cutting_amount,
      sale_received_date,
      payment_mode,
      payment_ref,
      payment_status,
      brand_breakdown,
      payments,
    } = req.body;

    const truckRes = await query('SELECT * FROM trucks WHERE id = $1', [truck_id]);
    if (truckRes.rows.length === 0) {
      return res.status(404).json({ message: 'Associated truck not found' });
    }
    const truck = truckRes.rows[0];

    // ---- Stock Validation against Inward Truck ----
    let truckInwardMap = {};
    let truckBreakdown = truck.brand_breakdown;
    if (typeof truckBreakdown === 'string') {
      try { truckBreakdown = JSON.parse(truckBreakdown); } catch (e) { truckBreakdown = null; }
    }
    if (truckBreakdown && typeof truckBreakdown === 'object') {
      Object.entries(truckBreakdown).forEach(([k, v]) => {
        truckInwardMap[k.trim().toUpperCase()] = Number(v) || 0;
      });
    } else if (truck.brand) {
      truckInwardMap[truck.brand.trim().toUpperCase()] = Number(truck.bags) || 0;
    }
    const truckTotalBags = Number(truck.bags) || 0;

    const otherSalesRes = await query(
      'SELECT id, bags, brand_breakdown FROM sales_bills WHERE truck_id = $1',
      [truck_id]
    );
    let otherSoldByColor = {};
    let totalOtherSoldBags = 0;
    otherSalesRes.rows.forEach((s) => {
      totalOtherSoldBags += Number(s.bags) || 0;
      let sb = s.brand_breakdown;
      if (typeof sb === 'string') {
        try { sb = JSON.parse(sb); } catch (e) { sb = null; }
      }
      if (sb && typeof sb === 'object') {
        Object.entries(sb).forEach(([col, cnt]) => {
          const cu = col.trim().toUpperCase();
          otherSoldByColor[cu] = (otherSoldByColor[cu] || 0) + (Number(cnt) || 0);
        });
      }
    });

    const totalAvailableOnTruck = Math.max(0, truckTotalBags - totalOtherSoldBags);
    const reqBagsTotal = Number(bags) || 0;
    if (reqBagsTotal > totalAvailableOnTruck) {
      return res.status(400).json({
        message: `Validation Error: Cannot sell ${reqBagsTotal.toLocaleString('en-IN')} bags. Only ${totalAvailableOnTruck.toLocaleString('en-IN')} bags remaining on Truck ${truck.truck_serial || truck.truck_number}!`
      });
    }

    if (brand_breakdown && typeof brand_breakdown === 'object') {
      for (const [col, cnt] of Object.entries(brand_breakdown)) {
        const cReq = Number(cnt) || 0;
        if (cReq <= 0) continue;
        const colUpper = col.trim().toUpperCase();
        const inwardForCol = truckInwardMap[colUpper] || 0;
        const soldForCol = otherSoldByColor[colUpper] || 0;
        const availableForCol = Math.max(0, inwardForCol - soldForCol);
        if (inwardForCol > 0 && cReq > availableForCol) {
          return res.status(400).json({
            message: `Validation Error: Cannot sell ${cReq.toLocaleString('en-IN')} bags of ${col}. Only ${availableForCol.toLocaleString('en-IN')} ${col} bags available on Truck ${truck.truck_serial || truck.truck_number}!`
          });
        }
      }
    }

    const masterRes = await query("SELECT value FROM masters WHERE key = 'system_settings'");
    const masters = masterRes.rows.length > 0 ? masterRes.rows[0].value : {};

    const calculatedQty = qty_qtls ? Number(qty_qtls) : Math.round((Number(bags) * 30 / 100) * 100) / 100;
    const effectiveLfRate = lf_rate !== undefined && lf_rate !== null && lf_rate !== '' ? Number(lf_rate) : Number(truck.truck_lf || 0);
    const effectiveLorryAdvance = lorry_advance !== undefined && lorry_advance !== null && lorry_advance !== '' ? Number(lorry_advance) : 0;

    const financials = calculateBillFinancials({
      billingRate: billing_rate,
      actualRate: actual_rate,
      qtyQtls: calculatedQty,
      truckLfRate: truck.truck_lf,
      lfRate: effectiveLfRate,
      lorryAdvance: effectiveLorryAdvance,
      purchaseRate: truck.rate_per_qtl,
      masters,
    });

    const purchaseBaseDate = truck.purchase_payment_date || truck.unloading_date || truck.date;

    // Multi-payment tranche parsing and exact interest tracking
    let paymentList = [];
    if (payments) {
      paymentList = typeof payments === 'string' ? JSON.parse(payments) : (Array.isArray(payments) ? payments : []);
    } else if (received_amount && Number(received_amount) > 0) {
      paymentList = [{
        amount: Number(received_amount),
        date: sale_received_date || null,
        mode: payment_mode || 'RTGS/NEFT',
        ref: payment_ref || null,
      }];
    }

    const multiInterest = calculateMultiPaymentInterest({
      payments: paymentList,
      purchasePaymentDate: purchaseBaseDate,
      annualRatePct: masters.annual_interest_rate || 12.0,
    });

    const totalReceivedVal = multiInterest.totalReceived > 0 ? multiInterest.totalReceived : (received_amount ? Number(received_amount) : null);
    const latestDate = paymentList.length > 0 ? paymentList[paymentList.length - 1].date : (sale_received_date || null);
    const latestMode = paymentList.length > 0 ? paymentList[paymentList.length - 1].mode : (payment_mode || null);
    const latestRef = paymentList.length > 0 ? paymentList[paymentList.length - 1].ref : (payment_ref || null);
    const totalInterestAmt = multiInterest.totalInterestLoss > 0 ? multiInterest.totalInterestLoss : multiInterest.totalInterestEarned;
    const interestTypeVal = multiInterest.interestType;
    const interestDaysVal = paymentList.length > 0 ? (multiInterest.enrichedPayments[multiInterest.enrichedPayments.length - 1].interest_days || 0) : 0;

    // Custom per-party negotiated brokerage:
    const finalBrokerageRate = brokerage_per_qtl !== undefined && brokerage_per_qtl !== null && brokerage_per_qtl !== ''
      ? Number(brokerage_per_qtl)
      : null;
    const finalBrokerageAmount = finalBrokerageRate !== null
      ? Math.round(finalBrokerageRate * calculatedQty * 100) / 100
      : null;

    // Auto-derive discount & cutting:
    const effectiveDiscPct = disc_pct !== undefined && disc_pct !== null && disc_pct !== '' ? Number(disc_pct) : 0.05;
    const grossPayable = financials.grossBillAmount;
    const effectiveDiscount =
      discount_amount !== undefined && discount_amount !== null && discount_amount !== ''
        ? Number(discount_amount)
        : Math.round(grossPayable * effectiveDiscPct * 100) / 100;
    const actualAmt = Math.round(((Number(actual_rate || 0) * calculatedQty) - financials.lorryBalance) * 100) / 100;
    const hasReceived = totalReceivedVal !== null && totalReceivedVal !== undefined;
    const effectiveCutting =
      cutting_amount !== undefined && cutting_amount !== null && cutting_amount !== ''
        ? Number(cutting_amount)
        : hasReceived
          ? Math.round((actualAmt - Number(totalReceivedVal) - effectiveDiscount) * 100) / 100
          : 0;

    let finalPaymentStatus = payment_status;
    if (!finalPaymentStatus || finalPaymentStatus === 'PENDING PAYMENT') {
      if (totalReceivedVal && totalReceivedVal > 0) {
        if (totalReceivedVal + effectiveDiscount + effectiveCutting >= financials.billAmount - 5) {
          finalPaymentStatus = effectiveCutting !== 0 ? 'CUTTING' : 'PAID';
        } else {
          finalPaymentStatus = 'PARTIAL PAYMENT';
        }
      } else {
        finalPaymentStatus = 'PENDING PAYMENT';
      }
    }

    const formattedBrandBreakdown = brand_breakdown && typeof brand_breakdown === 'object'
      ? JSON.stringify(brand_breakdown)
      : (brand_breakdown || null);

    const result = await query(
      `INSERT INTO sales_bills (
        truck_id, sale_bill_no, party_name, bags, qty_qtls, actual_rate, billing_rate,
        bill_amount, lorry_amount, purchase_rate, lf_rate, apmc_rate, it_rate,
        egb_rate, egb_trpt_rate, delhi_brk_rate, kasat_brk_rate, cd_rate, breakeven_rate,
        received_amount, disc_pct, discount_amount, cutting_amount, sale_received_date,
        interest_days, interest_amount, interest_type, payment_status,
        brokerage_per_qtl, brokerage_amount, payment_mode, payment_ref, brand_breakdown,
        lorry_advance, payments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
      RETURNING *`,
      [
        truck_id,
        sale_bill_no || `MH-${Date.now().toString().slice(-4)}`,
        party_name,
        Number(bags),
        calculatedQty,
        Number(actual_rate),
        Number(billing_rate),
        financials.billAmount,
        financials.lorryAmount,
        truck.rate_per_qtl,
        financials.effectiveLfRate,
        financials.apmcRate,
        financials.itRate,
        financials.egbRate,
        financials.egbTrptRate,
        financials.delhiBrkRate,
        financials.kasatBrkRate,
        financials.cdRate,
        financials.breakevenRate,
        totalReceivedVal,
        effectiveDiscPct,
        effectiveDiscount,
        effectiveCutting,
        latestDate,
        interestDaysVal,
        totalInterestAmt,
        interestTypeVal,
        finalPaymentStatus,
        finalBrokerageRate,
        finalBrokerageAmount,
        latestMode,
        latestRef,
        formattedBrandBreakdown,
        effectiveLorryAdvance,
        JSON.stringify(multiInterest.enrichedPayments),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating sales bill:', err);
    res.status(500).json({ message: 'Failed to create sales bill' });
  }
});

// PUT /api/sales/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sale_bill_no,
      party_name,
      bags,
      qty_qtls,
      actual_rate,
      billing_rate,
      lf_rate,
      lorry_advance,
      brokerage_per_qtl,
      received_amount,
      disc_pct,
      discount_amount,
      cutting_amount,
      sale_received_date,
      payment_mode,
      payment_ref,
      payment_status,
      brand_breakdown,
      payments,
    } = req.body;

    const curBillRes = await query('SELECT * FROM sales_bills WHERE id = $1', [id]);
    if (curBillRes.rows.length === 0) {
      return res.status(404).json({ message: 'Sales bill not found' });
    }
    const curBill = curBillRes.rows[0];

    const truckRes = await query('SELECT * FROM trucks WHERE id = $1', [curBill.truck_id]);
    const truck = truckRes.rows[0];

    // ---- Stock Validation against Inward Truck (excluding this sale id) ----
    if (truck) {
      let truckInwardMap = {};
      let truckBreakdown = truck.brand_breakdown;
      if (typeof truckBreakdown === 'string') {
        try { truckBreakdown = JSON.parse(truckBreakdown); } catch (e) { truckBreakdown = null; }
      }
      if (truckBreakdown && typeof truckBreakdown === 'object') {
        Object.entries(truckBreakdown).forEach(([k, v]) => {
          truckInwardMap[k.trim().toUpperCase()] = Number(v) || 0;
        });
      } else if (truck.brand) {
        truckInwardMap[truck.brand.trim().toUpperCase()] = Number(truck.bags) || 0;
      }
      const truckTotalBags = Number(truck.bags) || 0;

      const otherSalesRes = await query(
        'SELECT id, bags, brand_breakdown FROM sales_bills WHERE truck_id = $1 AND id != $2',
        [truck.id, id]
      );
      let otherSoldByColor = {};
      let totalOtherSoldBags = 0;
      otherSalesRes.rows.forEach((s) => {
        totalOtherSoldBags += Number(s.bags) || 0;
        let sb = s.brand_breakdown;
        if (typeof sb === 'string') {
          try { sb = JSON.parse(sb); } catch (e) { sb = null; }
        }
        if (sb && typeof sb === 'object') {
          Object.entries(sb).forEach(([col, cnt]) => {
            const cu = col.trim().toUpperCase();
            otherSoldByColor[cu] = (otherSoldByColor[cu] || 0) + (Number(cnt) || 0);
          });
        }
      });

      const totalAvailableOnTruck = Math.max(0, truckTotalBags - totalOtherSoldBags);
      const reqBagsTotal = Number(bags !== undefined ? bags : curBill.bags) || 0;
      if (reqBagsTotal > totalAvailableOnTruck) {
        return res.status(400).json({
          message: `Validation Error: Cannot sell ${reqBagsTotal.toLocaleString('en-IN')} bags. Only ${totalAvailableOnTruck.toLocaleString('en-IN')} bags remaining on Truck ${truck.truck_serial || truck.truck_number}!`
        });
      }

      const activeBreakdown = brand_breakdown !== undefined ? brand_breakdown : curBill.brand_breakdown;
      if (activeBreakdown && typeof activeBreakdown === 'object') {
        for (const [col, cnt] of Object.entries(activeBreakdown)) {
          const cReq = Number(cnt) || 0;
          if (cReq <= 0) continue;
          const colUpper = col.trim().toUpperCase();
          const inwardForCol = truckInwardMap[colUpper] || 0;
          const soldForCol = otherSoldByColor[colUpper] || 0;
          const availableForCol = Math.max(0, inwardForCol - soldForCol);
          if (inwardForCol > 0 && cReq > availableForCol) {
            return res.status(400).json({
              message: `Validation Error: Cannot sell ${cReq.toLocaleString('en-IN')} bags of ${col}. Only ${availableForCol.toLocaleString('en-IN')} ${col} bags available on Truck ${truck.truck_serial || truck.truck_number}!`
            });
          }
        }
      }
    }

    const masterRes = await query("SELECT value FROM masters WHERE key = 'system_settings'");
    const masters = masterRes.rows.length > 0 ? masterRes.rows[0].value : {};

    const calculatedQty = qty_qtls ? Number(qty_qtls) : Math.round((Number(bags !== undefined ? bags : curBill.bags) * 30 / 100) * 100) / 100;
    const effectiveLfRate = lf_rate !== undefined
      ? (lf_rate !== null && lf_rate !== '' ? Number(lf_rate) : Number(truck.truck_lf || 0))
      : (curBill.lf_rate !== null && curBill.lf_rate !== undefined ? Number(curBill.lf_rate) : Number(truck.truck_lf || 0));
    const effectiveLorryAdvance = lorry_advance !== undefined
      ? (lorry_advance !== null && lorry_advance !== '' ? Number(lorry_advance) : 0)
      : (curBill.lorry_advance !== null && curBill.lorry_advance !== undefined ? Number(curBill.lorry_advance) : 0);

    const financials = calculateBillFinancials({
      billingRate: billing_rate || curBill.billing_rate,
      actualRate: actual_rate || curBill.actual_rate,
      qtyQtls: calculatedQty,
      truckLfRate: truck.truck_lf,
      lfRate: effectiveLfRate,
      lorryAdvance: effectiveLorryAdvance,
      purchaseRate: truck.rate_per_qtl,
      masters,
    });

    const purchaseBaseDate = truck.purchase_payment_date || truck.unloading_date || truck.date;

    // Multi-payment tranche parsing and exact interest tracking
    let paymentList = [];
    if (payments !== undefined) {
      paymentList = typeof payments === 'string' ? JSON.parse(payments) : (Array.isArray(payments) ? payments : []);
    } else if (curBill.payments) {
      paymentList = typeof curBill.payments === 'string' ? JSON.parse(curBill.payments) : (Array.isArray(curBill.payments) ? curBill.payments : []);
    } else if (received_amount !== undefined && Number(received_amount) > 0) {
      paymentList = [{
        amount: Number(received_amount),
        date: sale_received_date || curBill.sale_received_date || null,
        mode: payment_mode || curBill.payment_mode || 'RTGS/NEFT',
        ref: payment_ref || curBill.payment_ref || null,
      }];
    }

    const multiInterest = calculateMultiPaymentInterest({
      payments: paymentList,
      purchasePaymentDate: purchaseBaseDate,
      annualRatePct: masters.annual_interest_rate || 12.0,
    });

    const totalReceivedVal = multiInterest.totalReceived > 0 
      ? multiInterest.totalReceived 
      : (received_amount !== undefined ? (received_amount !== '' && received_amount !== null ? Number(received_amount) : null) : curBill.received_amount);

    const latestDate = paymentList.length > 0 
      ? paymentList[paymentList.length - 1].date 
      : (sale_received_date !== undefined ? sale_received_date : curBill.sale_received_date);

    const latestMode = paymentList.length > 0 
      ? paymentList[paymentList.length - 1].mode 
      : (payment_mode !== undefined ? payment_mode : curBill.payment_mode);

    const latestRef = paymentList.length > 0 
      ? paymentList[paymentList.length - 1].ref 
      : (payment_ref !== undefined ? payment_ref : curBill.payment_ref);

    const totalInterestAmt = Math.abs(multiInterest.netInterest);
    const interestTypeVal = multiInterest.interestType;
    const interestDaysVal = paymentList.length > 0 ? (multiInterest.enrichedPayments[multiInterest.enrichedPayments.length - 1].interest_days || 0) : 0;

    // Custom per-party negotiated brokerage:
    const finalBrokerageRate = brokerage_per_qtl !== undefined
      ? (brokerage_per_qtl !== null && brokerage_per_qtl !== '' ? Number(brokerage_per_qtl) : null)
      : curBill.brokerage_per_qtl;
    const finalBrokerageAmount = finalBrokerageRate !== null && finalBrokerageRate !== undefined
      ? Math.round(Number(finalBrokerageRate) * calculatedQty * 100) / 100
      : null;

    // Auto-derive discount & cutting:
    const effectiveDiscPct = disc_pct !== undefined && disc_pct !== null && disc_pct !== '' ? Number(disc_pct) : (curBill.disc_pct ?? 0.05);
    const grossPayable = financials.grossBillAmount;
    const effectiveDiscount =
      discount_amount !== undefined && discount_amount !== null && discount_amount !== ''
        ? Number(discount_amount)
        : Math.round(grossPayable * effectiveDiscPct * 100) / 100;
    const actualAmt = Math.round(((Number(actual_rate || curBill.actual_rate) * calculatedQty) - financials.lorryBalance) * 100) / 100;
    const hasReceived = totalReceivedVal !== null && totalReceivedVal !== undefined && totalReceivedVal !== '';
    const effectiveCutting =
      cutting_amount !== undefined && cutting_amount !== null && cutting_amount !== ''
        ? Number(cutting_amount)
        : hasReceived
          ? Math.round((actualAmt - Number(totalReceivedVal) - effectiveDiscount) * 100) / 100
          : 0;

    let finalPaymentStatus = payment_status;
    if (!finalPaymentStatus || finalPaymentStatus === 'PENDING PAYMENT') {
      if (totalReceivedVal && Number(totalReceivedVal) > 0) {
        if (Number(totalReceivedVal) + effectiveDiscount + effectiveCutting >= financials.billAmount - 5) {
          finalPaymentStatus = effectiveCutting !== 0 ? 'CUTTING' : 'PAID';
        } else {
          finalPaymentStatus = 'PARTIAL PAYMENT';
        }
      } else {
        finalPaymentStatus = 'PENDING PAYMENT';
      }
    }

    const formattedBrandBreakdown = brand_breakdown !== undefined
      ? (brand_breakdown && typeof brand_breakdown === 'object' ? JSON.stringify(brand_breakdown) : brand_breakdown)
      : curBill.brand_breakdown;

    const result = await query(
      `UPDATE sales_bills SET
        sale_bill_no = COALESCE($1, sale_bill_no),
        party_name = COALESCE($2, party_name),
        bags = COALESCE($3, bags),
        qty_qtls = COALESCE($4, qty_qtls),
        actual_rate = COALESCE($5, actual_rate),
        billing_rate = COALESCE($6, billing_rate),
        bill_amount = COALESCE($7, bill_amount),
        lorry_amount = COALESCE($8, lorry_amount),
        apmc_rate = COALESCE($9, apmc_rate),
        it_rate = COALESCE($10, it_rate),
        breakeven_rate = COALESCE($11, breakeven_rate),
        received_amount = $12,
        disc_pct = $13,
        discount_amount = $14,
        cutting_amount = $15,
        sale_received_date = $16,
        interest_days = $17,
        interest_amount = $18,
        interest_type = $19,
        payment_status = COALESCE($20, payment_status),
        brokerage_per_qtl = $21,
        brokerage_amount = $22,
        payment_mode = $23,
        payment_ref = $24,
        brand_breakdown = $25,
        lf_rate = COALESCE($26, lf_rate),
        lorry_advance = COALESCE($27, lorry_advance),
        payments = $28
       WHERE id = $29
       RETURNING *`,
      [
        sale_bill_no,
        party_name,
        bags,
        calculatedQty,
        actual_rate,
        billing_rate,
        financials.billAmount,
        financials.lorryAmount,
        financials.apmcRate,
        financials.itRate,
        financials.breakevenRate,
        totalReceivedVal,
        effectiveDiscPct,
        effectiveDiscount,
        effectiveCutting,
        latestDate,
        interestDaysVal,
        totalInterestAmt,
        interestTypeVal,
        finalPaymentStatus,
        finalBrokerageRate,
        finalBrokerageAmount,
        latestMode,
        latestRef,
        formattedBrandBreakdown,
        financials.effectiveLfRate,
        effectiveLorryAdvance,
        JSON.stringify(multiInterest.enrichedPayments),
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating sales bill:', err);
    res.status(500).json({ message: 'Failed to update sales bill' });
  }
});

// DELETE /api/sales/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM sales_bills WHERE id = $1', [id]);
    res.json({ message: 'Sales bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete sales bill' });
  }
});

export default router;
