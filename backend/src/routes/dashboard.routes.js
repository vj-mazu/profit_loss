// ponytail: executive dashboard metrics, KPI cards, and risk alerts
import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/dashboard/metrics
router.get('/metrics', authenticate, async (req, res) => {
  try {
    // 1. Truck counts & volume
    const truckStats = await query(`
      SELECT 
        COUNT(*) as total_trucks,
        COUNT(*) FILTER (WHERE status = 'IN_TRANSIT') as in_transit,
        COUNT(*) FILTER (WHERE status = 'UNLOADED') as unloaded,
        COUNT(*) FILTER (WHERE status = 'SETTLED') as settled,
        COALESCE(SUM(bags), 0) as total_bags,
        COALESCE(SUM(qty_qtls), 0) as total_qtls,
        COALESCE(SUM(purchase_amount), 0) as total_purchase_amount
      FROM trucks
    `);

    // 2. Sales & Payment Stats
    const salesStats = await query(`
      SELECT 
        COUNT(*) as total_bills,
        COUNT(*) FILTER (WHERE payment_status = 'PENDING PAYMENT') as pending_count,
        COUNT(*) FILTER (WHERE payment_status = 'PAID') as paid_count,
        COUNT(*) FILTER (WHERE payment_status = 'CUTTING') as cutting_count,
        COALESCE(SUM(bill_amount), 0) as total_gross_sales,
        COALESCE(SUM(received_amount), 0) as total_received,
        COALESCE(SUM(bill_amount) FILTER (WHERE payment_status = 'PENDING PAYMENT'), 0) as pending_amount,
        COALESCE(SUM(cutting_amount), 0) as total_cutting,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(interest_amount) FILTER (WHERE interest_type = 'EARNED'), 0) as interest_earned,
        COALESCE(SUM(interest_amount) FILTER (WHERE interest_type = 'LOSS'), 0) as interest_loss
      FROM sales_bills
    `);

    // 3. Pending Payments with Aging (> 7 days)
    const overdueBills = await query(`
      SELECT s.*, t.truck_serial, t.truck_number, t.unloading_date
      FROM sales_bills s
      JOIN trucks t ON s.truck_id = t.id
      WHERE s.payment_status = 'PENDING PAYMENT'
      ORDER BY s.id DESC
      LIMIT 10
    `);

    // 4. Recent Trucks
    const recentTrucks = await query(`
      SELECT t.*, COUNT(s.id) as sales_count
      FROM trucks t
      LEFT JOIN sales_bills s ON t.id = s.truck_id
      GROUP BY t.id
      ORDER BY t.id DESC
      LIMIT 8
    `);

    res.json({
      trucks: truckStats.rows[0],
      sales: salesStats.rows[0],
      overdue_bills: overdueBills.rows,
      recent_trucks: recentTrucks.rows,
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
  }
});

export default router;
