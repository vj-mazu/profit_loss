// ponytail: purchase orders & EGB packaging inventory routes
import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  try {
    const ordersRes = await query(`
      SELECT 
        po.*,
        COALESCE(SUM(t.qty_qtls), 0) as lifted_qtls,
        COALESCE(SUM(t.bags), 0) as lifted_bags,
        COUNT(t.id) as trucks_count,
        (po.qty_qtls - COALESCE(SUM(t.qty_qtls), 0)) as remaining_qtls,
        (COALESCE(po.bags_given, 0) - COALESCE(SUM(t.bags), 0)) as remaining_bags
      FROM purchase_orders po
      LEFT JOIN trucks t ON po.id = t.order_id
      GROUP BY po.id
      ORDER BY po.id DESC
    `);

    // Fetch truck dispatches for accurate dynamic color deduction (handles multi-brand breakdowns)
    const truckDispatches = await query(`
      SELECT order_id, brand, brand_breakdown, bags
      FROM trucks
      WHERE order_id IS NOT NULL
    `);
    const usedByOrder = {};
    truckDispatches.rows.forEach(t => {
      if (!usedByOrder[t.order_id]) usedByOrder[t.order_id] = {};
      
      let breakdown = t.brand_breakdown;
      if (typeof breakdown === 'string') {
        try { breakdown = JSON.parse(breakdown); } catch (e) { breakdown = null; }
      }
      
      if (breakdown && typeof breakdown === 'object' && Object.keys(breakdown).length > 0) {
        Object.entries(breakdown).forEach(([bName, count]) => {
          const cleanB = String(bName).trim().toUpperCase();
          const bagsCount = Number(count) || 0;
          usedByOrder[t.order_id][cleanB] = (usedByOrder[t.order_id][cleanB] || 0) + bagsCount;
        });
      } else if (t.brand) {
        const cleanB = String(t.brand).trim().toUpperCase();
        const bagsCount = Number(t.bags) || 0;
        usedByOrder[t.order_id][cleanB] = (usedByOrder[t.order_id][cleanB] || 0) + bagsCount;
      }
    });

    const egbRes = await query('SELECT * FROM egb_stock ORDER BY id ASC');

    // Attach dynamic color breakdown & balance to each order row
    for (const row of ordersRes.rows) {
      const colorsSent = row.brand_colors && typeof row.brand_colors === 'object' ? row.brand_colors : {};
      const orderUsedMap = usedByOrder[row.id] || {};
      
      const breakdown = {};
      // 1. Process all colors configured as sent in this contract
      Object.entries(colorsSent).forEach(([col, count]) => {
        const sent = Number(count) || 0;
        const colUpper = col.trim().toUpperCase();
        const used = orderUsedMap[colUpper] || 0;
        breakdown[col] = {
          sent,
          used,
          remaining: Math.max(0, sent - used)
        };
      });

      // 2. Also ensure legacy Blue, Orange, Green are populated if present in old columns
      if (row.bags_given_blue && !breakdown['Blue'] && !breakdown['blue']) {
        const sent = Number(row.bags_given_blue) || 0;
        const used = orderUsedMap['BLUE'] || 0;
        breakdown['Blue'] = { sent, used, remaining: Math.max(0, sent - used) };
      }
      if (row.bags_given_orange && !breakdown['Orange'] && !breakdown['orange']) {
        const sent = Number(row.bags_given_orange) || 0;
        const used = orderUsedMap['ORANGE'] || 0;
        breakdown['Orange'] = { sent, used, remaining: Math.max(0, sent - used) };
      }
      if (row.bags_given_green && !breakdown['Green'] && !breakdown['green']) {
        const sent = Number(row.bags_given_green) || 0;
        const used = orderUsedMap['GREEN'] || 0;
        breakdown['Green'] = { sent, used, remaining: Math.max(0, sent - used) };
      }

      // 3. Capture any truck dispatches that used colors not explicitly in colorsSent
      Object.entries(orderUsedMap).forEach(([brandUpper, usedCount]) => {
        const matchKey = Object.keys(breakdown).find(k => k.trim().toUpperCase() === brandUpper);
        if (!matchKey) {
          breakdown[brandUpper] = {
            sent: 0,
            used: Number(usedCount) || 0,
            remaining: -(Number(usedCount) || 0)
          };
        }
      });

      row.color_breakdown = breakdown;

      // Legacy support fields
      row.egb_given_blue = Number(breakdown['Blue']?.sent || breakdown['blue']?.sent || row.bags_given_blue || 0);
      row.egb_given_orange = Number(breakdown['Orange']?.sent || breakdown['orange']?.sent || row.bags_given_orange || 0);
      row.egb_given_green = Number(breakdown['Green']?.sent || breakdown['green']?.sent || row.bags_given_green || 0);
      row.used_blue = Number(breakdown['Blue']?.used || breakdown['blue']?.used || 0);
      row.used_orange = Number(breakdown['Orange']?.used || breakdown['orange']?.used || 0);
      row.used_green = Number(breakdown['Green']?.used || breakdown['green']?.used || 0);
      row.egb_remaining_blue = Math.max(0, row.egb_given_blue - row.used_blue);
      row.egb_remaining_orange = Math.max(0, row.egb_given_orange - row.used_orange);
      row.egb_remaining_green = Math.max(0, row.egb_given_green - row.used_green);
    }
    res.json({
      orders: ordersRes.rows,
      egb_stock: egbRes.rows,
    });
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    res.status(500).json({ message: 'Failed to fetch purchase orders and EGB stock' });
  }
});

// Helper: Calculate next unique contract number starting from PO-01, PO-02, ...
export async function getNextContractNo() {
  const res = await query("SELECT contract_no FROM purchase_orders WHERE contract_no ILIKE 'PO-%'");
  let maxNum = 0;
  const existingSet = new Set();
  
  res.rows.forEach((r) => {
    if (r.contract_no) {
      const trimmed = r.contract_no.trim().toUpperCase();
      existingSet.add(trimmed);
      const match = trimmed.match(/^PO-0*(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  let nextNum = maxNum + 1;
  let candidate = `PO-${String(nextNum).padStart(2, '0')}`;
  while (existingSet.has(candidate.toUpperCase())) {
    nextNum++;
    candidate = `PO-${String(nextNum).padStart(2, '0')}`;
  }
  return candidate;
}

// GET /api/orders/next-contract-no
router.get('/next-contract-no', authenticate, async (req, res) => {
  try {
    const nextNo = await getNextContractNo();
    res.json({ next_contract_no: nextNo });
  } catch (err) {
    console.error('Error generating next contract number:', err);
    res.status(500).json({ message: 'Failed to generate contract number' });
  }
});

// POST /api/orders (Create new purchase contract)
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      contract_no,
      seller_name,
      seller_address,
      gst_no,
      contract_date,
      qty_qtls,
      rate_per_qtl,
      brand_colors,
      kg_per_bag,
      bags_given,
      bags_given_blue,
      bags_given_orange,
      bags_given_green,
      bag_transport_cost,
      egb_rate_per_qtl,
      buying_brokerage_per_qtl,
      broker_name,
    } = req.body;

    let totalBagsGiven = 0;
    if (brand_colors && typeof brand_colors === 'object') {
      Object.values(brand_colors).forEach(val => {
        totalBagsGiven += Number(val) || 0;
      });
    }
    if (totalBagsGiven === 0) {
      totalBagsGiven = (Number(bags_given_blue) || 0) + (Number(bags_given_orange) || 0) + (Number(bags_given_green) || 0) || Number(bags_given) || 0;
    }

    // GSTIN must be exactly the 15-digit format if provided
    if (gst_no && String(gst_no).trim().length > 15) {
      return res.status(400).json({ message: 'GSTIN cannot exceed 15 characters' });
    }
    if (!qty_qtls || Number(qty_qtls) <= 0) {
      return res.status(400).json({ message: 'Contract Qty (Qtls) must be a positive number' });
    }

    // Determine unique contract number starting with PO-01
    let finalContractNo = contract_no && contract_no.trim() !== '' ? contract_no.trim().toUpperCase() : '';
    if (!finalContractNo) {
      finalContractNo = await getNextContractNo();
    } else {
      // Check if provided contract_no already exists to guarantee uniqueness
      const existing = await query('SELECT id FROM purchase_orders WHERE UPPER(contract_no) = $1', [finalContractNo]);
      if (existing.rows.length > 0) {
        finalContractNo = await getNextContractNo();
      }
    }

    const manualEgbRate = egb_rate_per_qtl !== undefined && egb_rate_per_qtl !== '' && egb_rate_per_qtl !== null
      ? Number(egb_rate_per_qtl)
      : 100;
    const buyingBrokerage = buying_brokerage_per_qtl !== undefined && buying_brokerage_per_qtl !== '' && buying_brokerage_per_qtl !== null
      ? Number(buying_brokerage_per_qtl)
      : 0;

    const result = await query(
      `INSERT INTO purchase_orders (
        contract_no, seller_name, seller_address, gst_no,
        contract_date, qty_qtls, rate_per_qtl, brand_colors,
        kg_per_bag, bags_given, bags_given_blue, bags_given_orange, bags_given_green, bag_transport_cost, egb_rate_per_qtl,
        buying_brokerage_per_qtl, broker_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        finalContractNo,
        seller_name,
        seller_address || '',
        gst_no || '',
        contract_date || new Date().toISOString().split('T')[0],
        Number(qty_qtls),
        Number(rate_per_qtl),
        JSON.stringify(brand_colors || {}),
        Number(kg_per_bag) || 30,
        totalBagsGiven,
        Number(bags_given_blue) || 0,
        Number(bags_given_orange) || 0,
        Number(bags_given_green) || 0,
        Number(bag_transport_cost) || 0,
        manualEgbRate,
        buyingBrokerage,
        broker_name || '',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ message: 'Failed to create purchase order' });
  }
});

// PUT /api/orders/:id (Update purchase order)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      contract_no,
      seller_name,
      seller_address,
      gst_no,
      contract_date,
      qty_qtls,
      rate_per_qtl,
      brand_colors,
      kg_per_bag,
      bags_given,
      bags_given_blue,
      bags_given_orange,
      bags_given_green,
      bag_transport_cost,
      egb_rate_per_qtl,
      buying_brokerage_per_qtl,
      broker_name,
    } = req.body;

    let totalBagsGiven = undefined;
    if (brand_colors && typeof brand_colors === 'object') {
      let sum = 0;
      Object.values(brand_colors).forEach(val => {
        sum += Number(val) || 0;
      });
      if (sum > 0) totalBagsGiven = sum;
    }
    if (totalBagsGiven === undefined) {
      totalBagsGiven = (Number(bags_given_blue) || 0) + (Number(bags_given_orange) || 0) + (Number(bags_given_green) || 0) || (bags_given !== undefined ? Number(bags_given) : undefined);
    }

    // Same GSTIN rule on updates
    if (gst_no && String(gst_no).trim().length > 15) {
      return res.status(400).json({ message: 'GSTIN cannot exceed 15 characters' });
    }

    const manualEgbRate = egb_rate_per_qtl !== undefined && egb_rate_per_qtl !== '' && egb_rate_per_qtl !== null
      ? Number(egb_rate_per_qtl)
      : null;
    const manualBuyingBrokerage = buying_brokerage_per_qtl !== undefined && buying_brokerage_per_qtl !== '' && buying_brokerage_per_qtl !== null
      ? Number(buying_brokerage_per_qtl)
      : null;

    const result = await query(
      `UPDATE purchase_orders SET
        contract_no = COALESCE($1, contract_no),
        seller_name = COALESCE($2, seller_name),
        seller_address = COALESCE($3, seller_address),
        gst_no = COALESCE($4, gst_no),
        contract_date = COALESCE($5, contract_date),
        qty_qtls = COALESCE($6, qty_qtls),
        rate_per_qtl = COALESCE($7, rate_per_qtl),
        brand_colors = COALESCE($8, brand_colors),
        kg_per_bag = COALESCE($9, kg_per_bag),
        bags_given = COALESCE($10, bags_given),
        bags_given_blue = COALESCE($11, bags_given_blue),
        bags_given_orange = COALESCE($12, bags_given_orange),
        bags_given_green = COALESCE($13, bags_given_green),
        bag_transport_cost = COALESCE($14, bag_transport_cost),
        egb_rate_per_qtl = COALESCE($15, egb_rate_per_qtl),
        buying_brokerage_per_qtl = COALESCE($16, buying_brokerage_per_qtl),
        broker_name = COALESCE($17, broker_name)
       WHERE id = $18
       RETURNING *`,
      [
        contract_no,
        seller_name,
        seller_address,
        gst_no,
        contract_date,
        qty_qtls ? Number(qty_qtls) : null,
        rate_per_qtl ? Number(rate_per_qtl) : null,
        brand_colors ? JSON.stringify(brand_colors) : null,
        kg_per_bag ? Number(kg_per_bag) : null,
        totalBagsGiven !== undefined ? Number(totalBagsGiven) : null,
        bags_given_blue !== undefined ? Number(bags_given_blue) : null,
        bags_given_orange !== undefined ? Number(bags_given_orange) : null,
        bags_given_green !== undefined ? Number(bags_given_green) : null,
        bag_transport_cost !== undefined ? Number(bag_transport_cost) : null,
        manualEgbRate,
        manualBuyingBrokerage,
        broker_name,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ message: 'Failed to update purchase order' });
  }
});

// GET /api/orders/:id/trucks (Fetch all trucks lifted under an order)
router.get('/:id/trucks', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT t.*, 
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.bags), 0) as allocated_bags,
        COALESCE(SUM(s.bill_amount), 0) as total_sales_amount,
        COALESCE(SUM(s.received_amount), 0) as total_received_amount
      FROM trucks t
      LEFT JOIN sales_bills s ON t.id = s.truck_id
      WHERE t.order_id = $1
      GROUP BY t.id
      ORDER BY t.date ASC, t.id ASC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching order trucks:', err);
    res.status(500).json({ message: 'Failed to fetch trucks for this order' });
  }
});

// DELETE /api/orders/:id (Delete purchase order)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM purchase_orders WHERE id = $1', [id]);
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete purchase order' });
  }
});

// PUT /api/orders/egb/:id (Update EGB stock row)
router.put('/egb/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      blue_bags,
      orange_bags,
      green_bags,
      total_bags,
      tons,
      no_of_bundles,
      rc_tempo_bus,
      lf_per_qtl,
    } = req.body;

    const result = await query(
      `UPDATE egb_stock SET
        blue_bags = COALESCE($1, blue_bags),
        orange_bags = COALESCE($2, orange_bags),
        green_bags = COALESCE($3, green_bags),
        total_bags = COALESCE($4, total_bags),
        tons = COALESCE($5, tons),
        no_of_bundles = COALESCE($6, no_of_bundles),
        rc_tempo_bus = COALESCE($7, rc_tempo_bus),
        lf_per_qtl = COALESCE($8, lf_per_qtl),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        blue_bags,
        orange_bags,
        green_bags,
        total_bags,
        tons,
        no_of_bundles,
        rc_tempo_bus,
        lf_per_qtl,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update EGB stock' });
  }
});

export default router;
