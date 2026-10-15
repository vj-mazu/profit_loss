// ponytail: pixel-perfect, auto-fitted, pre-styled Excel export using ExcelJS
import { Router } from 'express';
import ExcelJS from 'exceljs';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Helper to auto-fit columns with safety padding
function autoFitColumns(worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellLen = cell.value ? cell.value.toString().length : 0;
      if (cellLen > maxLen) {
        maxLen = cellLen;
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 14), 45);
  });
}

// GET /api/export/excel (Complete pre-formatted workbook)
router.get('/excel', authenticate, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Profit Loss ERP';
    workbook.created = new Date();

    const trucksRes = await query('SELECT * FROM trucks ORDER BY id ASC');
    const salesRes = await query(`
      SELECT s.*, t.truck_serial, t.truck_number 
      FROM sales_bills s 
      JOIN trucks t ON s.truck_id = t.id 
      ORDER BY s.id ASC
    `);
    const egbRes = await query('SELECT * FROM egb_stock ORDER BY id ASC');

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' }, // Dark Forest Green
    };
    const headerFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    };

    // -------------------------------------------------------------
    // SHEET 1: TRUCKS & INWARD LOGISTICS
    // -------------------------------------------------------------
    const wsTrucks = workbook.addWorksheet('Trucks Logistics', {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    wsTrucks.columns = [
      { header: 'Truck Serial', key: 'truck_serial' },
      { header: 'Truck Number', key: 'truck_number' },
      { header: 'Date', key: 'date' },
      { header: 'Purchase Bill', key: 'purchase_bill_no' },
      { header: 'Party / Mill', key: 'seller_name' },
      { header: 'Bags (30KG)', key: 'bags' },
      { header: 'Qty (Qtls)', key: 'qty_qtls' },
      { header: 'Purchase Rate', key: 'rate_per_qtl' },
      { header: 'Lorry Freight (LF)', key: 'truck_lf' },
      { header: 'Purchase Amount (₹)', key: 'purchase_amount' },
      { header: 'Lorry Advance (₹)', key: 'lorry_advance' },
      { header: 'Brand', key: 'brand' },
      { header: 'Unload Date', key: 'unloading_date' },
      { header: 'Status', key: 'status' },
      { header: 'Remarks', key: 'remarks' },
    ];

    wsTrucks.getRow(1).height = 28;
    wsTrucks.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    trucksRes.rows.forEach((t) => {
      const row = wsTrucks.addRow({
        truck_serial: t.truck_serial,
        truck_number: t.truck_number,
        date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
        purchase_bill_no: t.purchase_bill_no,
        seller_name: t.seller_name,
        bags: Number(t.bags),
        qty_qtls: Number(t.qty_qtls),
        rate_per_qtl: Number(t.rate_per_qtl),
        truck_lf: Number(t.truck_lf),
        purchase_amount: Number(t.purchase_amount),
        lorry_advance: Number(t.lorry_advance),
        brand: t.brand,
        unloading_date: t.unloading_date ? new Date(t.unloading_date).toISOString().split('T')[0] : '',
        status: t.status,
        remarks: t.remarks || '',
      });

      row.height = 22;
      row.eachCell((cell) => {
        cell.border = borderStyle;
        cell.font = { name: 'Arial', size: 10 };
      });
    });

    autoFitColumns(wsTrucks);

    // -------------------------------------------------------------
    // SHEET 2: SALES BILLS & WHOLESALE SETTLEMENT
    // -------------------------------------------------------------
    const wsSales = workbook.addWorksheet('Sales & Profit-Loss', {
      pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    wsSales.columns = [
      { header: 'Truck Serial', key: 'truck_serial' },
      { header: 'Sale Bill', key: 'sale_bill_no' },
      { header: 'Buyer Party', key: 'party_name' },
      { header: 'Bags', key: 'bags' },
      { header: 'Qty (Qtls)', key: 'qty_qtls' },
      { header: 'Actual Rate', key: 'actual_rate' },
      { header: 'Billing Rate', key: 'billing_rate' },
      { header: 'Bill Amount (₹)', key: 'bill_amount' },
      { header: 'Lorry Freight (₹)', key: 'lorry_amount' },
      { header: 'Breakeven Rate', key: 'breakeven_rate' },
      { header: 'Received Amount (₹)', key: 'received_amount' },
      { header: 'Cash Disc (₹)', key: 'discount_amount' },
      { header: 'Cutting (₹)', key: 'cutting_amount' },
      { header: 'Sale Recv Date', key: 'sale_received_date' },
      { header: 'Float Days', key: 'interest_days' },
      { header: 'Interest Accrued (₹)', key: 'interest_amount' },
      { header: 'Status', key: 'payment_status' },
    ];

    wsSales.getRow(1).height = 28;
    wsSales.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    salesRes.rows.forEach((s) => {
      const row = wsSales.addRow({
        truck_serial: s.truck_serial,
        sale_bill_no: s.sale_bill_no,
        party_name: s.party_name,
        bags: Number(s.bags),
        qty_qtls: Number(s.qty_qtls),
        actual_rate: Number(s.actual_rate),
        billing_rate: Number(s.billing_rate),
        bill_amount: Number(s.bill_amount),
        lorry_amount: Number(s.lorry_amount),
        breakeven_rate: Number(s.breakeven_rate || 0),
        received_amount: s.received_amount ? Number(s.received_amount) : '',
        discount_amount: Number(s.discount_amount || 0),
        cutting_amount: Number(s.cutting_amount || 0),
        sale_received_date: s.sale_received_date ? new Date(s.sale_received_date).toISOString().split('T')[0] : '',
        interest_days: s.interest_days || 0,
        interest_amount: Number(s.interest_amount || 0),
        payment_status: s.payment_status,
      });

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.font = { name: 'Arial', size: 10 };
        // Highlight status
        if (colNumber === 17) {
          if (s.payment_status === 'PAID') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8F3DC' } }; // Light green
          } else if (s.payment_status === 'PENDING PAYMENT') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD8D8' } }; // Light red
          } else if (s.payment_status === 'CUTTING') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }; // Light yellow
          }
        }
      });
    });

    autoFitColumns(wsSales);

    // -------------------------------------------------------------
    // SHEET 3: EGB PACKAGING STOCK
    // -------------------------------------------------------------
    const wsEgb = workbook.addWorksheet('EGB Packaging Stock');
    wsEgb.columns = [
      { header: 'Seller / Mill', key: 'seller_name' },
      { header: 'Blue Bags', key: 'blue_bags' },
      { header: 'Orange Bags', key: 'orange_bags' },
      { header: 'Green Bags', key: 'green_bags' },
      { header: 'Total Bags', key: 'total_bags' },
      { header: 'Tons', key: 'tons' },
      { header: 'Bundles', key: 'no_of_bundles' },
      { header: 'Tempo/Bus Freight (₹)', key: 'rc_tempo_bus' },
      { header: 'LF Per Qtl (₹)', key: 'lf_per_qtl' },
    ];

    wsEgb.getRow(1).height = 28;
    wsEgb.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    egbRes.rows.forEach((e) => {
      const row = wsEgb.addRow(e);
      row.height = 22;
      row.eachCell((cell) => {
        cell.border = borderStyle;
        cell.font = { name: 'Arial', size: 10 };
      });
    });

    autoFitColumns(wsEgb);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Profit_Loss_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel export:', err);
    res.status(500).json({ message: 'Failed to generate Excel export' });
  }
});

export default router;
