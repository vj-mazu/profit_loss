// ponytail: settlement ledger & net profit calculation
import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { calculateFloatInterest, calculateMultiPaymentInterest } from '../utils/calculations.js';

const router = Router();

// GET /api/settlement/summary (Get fleet-wide P&L summary across all trucks)
router.get('/summary', authenticate, async (req, res) => {
  try {
    const trucksRes = await query(`
      SELECT t.*, 
        po.contract_no as linked_contract_no,
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
      GROUP BY t.id, po.contract_no
      ORDER BY t.id DESC
    `);

    const masterRes = await query("SELECT value FROM masters WHERE key = 'system_settings'");
    const masters = masterRes.rows.length > 0 ? masterRes.rows[0].value : {};

    const summaryList = trucksRes.rows.map((t) => {
      const qtls = Number(t.qty_qtls) || 0;
      const salesAmt = Number(t.total_sales_amount) || 0;
      const receivedAmt = Number(t.total_received_amount) || 0;
      const cdPct = t.purchase_cd_pct !== null && t.purchase_cd_pct !== undefined ? Number(t.purchase_cd_pct) : 2.0;
      const purchasePaid = t.purchase_payment_amount 
        ? Number(t.purchase_payment_amount) 
        : Math.round(Number(t.purchase_amount || 0) * (1 - cdPct / 100) * 100) / 100;
      const apmcCost = Math.round(((salesAmt * Number(masters.apmc_pct || 0.6)) / 100) * 100) / 100;
      const itCost = Math.round(((salesAmt * Number(masters.it_tcs_pct || 0.39)) / 100) * 100) / 100;
      const egbCost = Math.round(qtls * Number(masters.egb_cost_per_qtl || 100) * 100) / 100;
      const egbTrptCost = Math.round(qtls * Number(masters.egb_trpt_per_qtl || 20) * 100) / 100;
      const delhiComm = Math.round(qtls * Number(masters.delhi_brokerage_default || 60) * 100) / 100;
      const kasatComm = Math.round(qtls * Number(masters.kasat_brokerage_default || 40) * 100) / 100;

      // Use actual negotiated party brokerage if custom brokerage was recorded, otherwise fallback
      const defaultBrokerage = delhiComm + kasatComm;
      const actualBrokerage = Number(t.custom_brokerage_count) > 0 
        ? Number(t.total_brokerage_amount) 
        : defaultBrokerage;

      const costOfGoods = Math.round((purchasePaid + apmcCost + itCost + egbCost + egbTrptCost + actualBrokerage) * 100) / 100;
      const effectiveInflow = receivedAmt > 0 ? receivedAmt : salesAmt;
      const tradingProfit = Math.round((effectiveInflow - costOfGoods) * 100) / 100;
      const delayInterest = Number(t.purchase_delay_interest || 0) + Number(t.interest_loss || 0);
      const earnedInterest = Number(t.interest_earned || 0);
      const netProfit = Math.round((tradingProfit - delayInterest + earnedInterest) * 100) / 100;
      const profitPerQtl = qtls > 0 ? Math.round((netProfit / qtls) * 100) / 100 : 0;

      return {
        ...t,
        cost_of_goods: costOfGoods,
        effective_inflow: effectiveInflow,
        trading_profit: tradingProfit,
        net_profit: Number(t.sales_count) > 0 ? netProfit : null,
        profit_per_qtl: Number(t.sales_count) > 0 ? profitPerQtl : null,
      };
    });

    res.json(summaryList);
  } catch (err) {
    console.error('Error fetching settlement summary:', err);
    res.status(500).json({ message: 'Failed to fetch settlement summary' });
  }
});

// GET /api/settlement/truck/:id (Get full P&L and financial ledger for a specific truck)
router.get('/truck/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const truckRes = await query('SELECT * FROM trucks WHERE id = $1', [id]);
    if (truckRes.rows.length === 0) {
      return res.status(404).json({ message: 'Truck not found' });
    }
    const truck = truckRes.rows[0];

    const salesRes = await query('SELECT * FROM sales_bills WHERE truck_id = $1 ORDER BY id ASC', [id]);
    const sales = salesRes.rows;

    const masterRes = await query("SELECT value FROM masters WHERE key = 'system_settings'");
    const masters = masterRes.rows.length > 0 ? masterRes.rows[0].value : {};
    const annualRate = masters.annual_interest_rate || 12.0;

    // Calculate aggregations
    let totalBagsSold = 0;
    let totalQtlsSold = 0;
    let totalBillAmount = 0;
    let totalLorryDeduction = 0;
    let totalReceivedAmount = 0;
    let totalDiscount = 0;
    let totalCutting = 0;
    let totalInterestEarned = 0; // Negative interest in sheet convention
    let totalInterestLoss = 0;

    sales.forEach((s) => {
      totalBagsSold += Number(s.bags || 0);
      totalQtlsSold += Number(s.qty_qtls || 0);
      totalBillAmount += Number(s.bill_amount || 0);
      totalLorryDeduction += Math.max(0, Number(s.lorry_amount || 0) - Number(s.lorry_advance || 0));
      totalReceivedAmount += Number(s.received_amount || 0);
      totalDiscount += Number(s.discount_amount || 0);
      totalCutting += Number(s.cutting_amount || 0);

      // Re-evaluate float interest based on truck's purchase_payment_date, or arrival date (unloading_date / date)
      const purchaseBaseDate = truck.purchase_payment_date || truck.unloading_date || truck.date;
      let billPayments = [];
      if (s.payments) {
        billPayments = typeof s.payments === 'string' ? JSON.parse(s.payments) : (Array.isArray(s.payments) ? s.payments : []);
      } else if (s.received_amount && s.sale_received_date) {
        billPayments = [{ amount: Number(s.received_amount), date: s.sale_received_date }];
      }

      if (billPayments.length > 0 && purchaseBaseDate) {
        const multi = calculateMultiPaymentInterest({
          payments: billPayments,
          purchasePaymentDate: purchaseBaseDate,
          annualRatePct: annualRate,
        });
        totalInterestEarned += multi.totalInterestEarned;
        totalInterestLoss += multi.totalInterestLoss;
      }
    });

    // Cost Of Goods Calculation for this truck:
    // Purchase amount (-CD%) + APMC (0.6%) + IT (0.39%) + EGB (100) + EGB Trpt (20) + Delhi Brk (60) + Kasat Brk (40)
    const cdPct = truck.purchase_cd_pct !== null && truck.purchase_cd_pct !== undefined ? Number(truck.purchase_cd_pct) : 2.0;
    const purchasePaid = truck.purchase_payment_amount
      ? Number(truck.purchase_payment_amount)
      : Math.round(Number(truck.purchase_amount) * (1 - cdPct / 100) * 100) / 100;

    const apmcCost = Math.round(((totalBillAmount * Number(masters.apmc_pct || 0.6)) / 100) * 100) / 100;
    const itCost = Math.round(((totalBillAmount * Number(masters.it_tcs_pct || 0.39)) / 100) * 100) / 100;
    const egbCost = Math.round(Number(truck.qty_qtls) * Number(masters.egb_cost_per_qtl || 100) * 100) / 100;
    const egbTrptCost = Math.round(Number(truck.qty_qtls) * Number(masters.egb_trpt_per_qtl || 20) * 100) / 100;
    const delhiComm = Math.round(Number(truck.qty_qtls) * Number(masters.delhi_brokerage_default || 60) * 100) / 100;
    const kasatComm = Math.round(Number(truck.qty_qtls) * Number(masters.kasat_brokerage_default || 40) * 100) / 100;

    // Compute actual negotiated party brokerage from sales bills
    let totalSalesBrokerage = 0;
    let hasCustomBrokerage = false;
    sales.forEach((s) => {
      if (s.brokerage_per_qtl !== null && s.brokerage_per_qtl !== undefined && s.brokerage_per_qtl !== '') {
        const brkAmt = s.brokerage_amount !== null && s.brokerage_amount !== undefined
          ? Number(s.brokerage_amount)
          : Math.round(Number(s.brokerage_per_qtl) * Number(s.qty_qtls || 0) * 100) / 100;
        totalSalesBrokerage += brkAmt;
        hasCustomBrokerage = true;
      }
    });

    const defaultBrokerageTotal = Math.round((delhiComm + kasatComm) * 100) / 100;
    const effectiveBrokerageCost = hasCustomBrokerage ? Math.round(totalSalesBrokerage * 100) / 100 : defaultBrokerageTotal;

    const costOfGoods = Math.round((purchasePaid + apmcCost + itCost + egbCost + egbTrptCost + effectiveBrokerageCost) * 100) / 100;

    // Mill purchase delay interest (financing gap)
    let purchaseDelayInterest = 0;
    if (truck.purchase_payment_date && truck.sale_amount_received_date) {
      const d1 = new Date(truck.purchase_payment_date);
      const d2 = new Date(truck.sale_amount_received_date);
      const gapDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (gapDays > 0) {
        purchaseDelayInterest = Math.round(((purchasePaid * (annualRate / 100) * gapDays) / 365) * 100) / 100;
      }
    }

    const netInterestAccrued = Math.round((totalInterestEarned - totalInterestLoss - purchaseDelayInterest) * 100) / 100;

    // Net Realized Profit = (Total Received from buyers - Cost of Goods) + Net Interest Accrued
    const tradingProfit = Math.round((totalReceivedAmount - costOfGoods) * 100) / 100;
    const netProfit = Math.round((tradingProfit + netInterestAccrued) * 100) / 100;

    res.json({
      truck,
      sales,
      metrics: {
        totalBagsSold,
        totalQtlsSold,
        totalBillAmount,
        totalLorryDeduction,
        totalReceivedAmount,
        totalDiscount,
        totalCutting,
        purchasePaid,
        apmcCost,
        itCost,
        egbCost,
        egbTrptCost,
        delhiComm,
        kasatComm,
        effectiveBrokerageCost,
        hasCustomBrokerage,
        totalSalesBrokerage,
        costOfGoods,
        totalInterestEarned,
        totalInterestLoss,
        purchaseDelayInterest,
        netInterestAccrued,
        tradingProfit,
        netProfit,
      },
    });
  } catch (err) {
    console.error('Error fetching settlement:', err);
    res.status(500).json({ message: 'Failed to calculate settlement ledger' });
  }
});

// PUT /api/settlement/truck/:id/payment (Update truck payment details to mill)
router.put('/truck/:id/payment', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      purchase_payment_amount,
      purchase_payment_date,
      purchase_payment_mode,
      purchase_payment_ref,
      purchase_cd_pct,
      sale_amount_received_date,
      status,
    } = req.body;

    const truckRes = await query('SELECT * FROM trucks WHERE id = $1', [id]);
    if (truckRes.rows.length === 0) {
      return res.status(404).json({ message: 'Truck not found' });
    }
    const truck = truckRes.rows[0];

    const masterRes = await query("SELECT value FROM masters WHERE key = 'system_settings'");
    const masters = masterRes.rows.length > 0 ? masterRes.rows[0].value : {};
    const annualRate = masters.annual_interest_rate || 12.0;

    let gapDays = 0;
    let delayInterest = 0;
    if (purchase_payment_date && sale_amount_received_date) {
      const d1 = new Date(purchase_payment_date);
      const d2 = new Date(sale_amount_received_date);
      gapDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (gapDays > 0) {
        const amt = Number(purchase_payment_amount || truck.purchase_amount);
        delayInterest = Math.round(((amt * (annualRate / 100) * gapDays) / 365) * 100) / 100;
      }
    }

    const updated = await query(
      `UPDATE trucks SET
        purchase_payment_amount = $1,
        purchase_payment_date = $2,
        purchase_payment_mode = COALESCE($3, purchase_payment_mode),
        purchase_payment_ref = COALESCE($4, purchase_payment_ref),
        sale_amount_received_date = $5,
        purchase_gap_days = $6,
        purchase_delay_interest = $7,
        status = COALESCE($8, status),
        purchase_cd_pct = COALESCE($9, purchase_cd_pct)
       WHERE id = $10
       RETURNING *`,
      [
        purchase_payment_amount,
        purchase_payment_date,
        purchase_payment_mode || null,
        purchase_payment_ref || null,
        sale_amount_received_date,
        gapDays,
        delayInterest,
        status,
        purchase_cd_pct !== undefined && purchase_cd_pct !== '' && purchase_cd_pct !== null ? Number(purchase_cd_pct) : null,
        id,
      ]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating truck payment:', err);
    res.status(500).json({ message: 'Failed to update truck payment settlement' });
  }
});

export default router;
