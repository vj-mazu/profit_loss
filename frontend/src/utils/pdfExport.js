import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Format currency in Indian numbering
const formatINR = (val) => {
  const num = Number(val) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export function exportFleetPdf(trucks = [], title = 'Consolidated Fleet Profit & Loss Statement') {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text('PROFIT LOSS SOFTWARE - FLEET CONSOLIDATED P&L', 40, 36);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${title} | Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | ${trucks.length} Dispatches`, 40, 52);

  const tableHead = [
    [
      'Serial',
      'Truck Number',
      'Miller / Supplier',
      'Bags',
      'Qtls',
      'Mill Outflow',
      'Total COGS',
      'Sales Inflow',
      'Net Profit (P&L)',
      'Rate/Qtl',
      'Status',
    ],
  ];

  let totBags = 0, totQtls = 0, totMill = 0, totCOGS = 0, totInflow = 0, totProfit = 0;

  const tableBody = trucks.map((t) => {
    const b = Number(t.bags || 0);
    const q = Number(t.qty_qtls || 0);
    const cdPct = t.purchase_cd_pct !== null && t.purchase_cd_pct !== undefined ? Number(t.purchase_cd_pct) : 2.0;
    const mOut = Number(t.purchase_payment_amount || Number(t.purchase_amount || 0) * (1 - cdPct / 100));
    const cogs = Number(t.cost_of_goods || 0);
    const inflow = Number(t.effective_inflow || 0);
    const np = Number(t.net_profit || 0);

    totBags += b;
    totQtls += q;
    totMill += mOut;
    totCOGS += cogs;
    totInflow += inflow;
    totProfit += np;

    return [
      t.truck_serial || '-',
      t.truck_number || '-',
      t.seller_name || '-',
      b.toLocaleString('en-IN'),
      q.toFixed(1),
      formatINR(mOut),
      formatINR(cogs),
      formatINR(inflow),
      formatINR(np),
      q > 0 ? `Rs. ${(np / q).toFixed(1)}/Q` : '-',
      t.status || 'UNLOADED',
    ];
  });

  // Footer Totals Row
  const tableFoot = [
    [
      'TOTAL',
      `${trucks.length} Trucks`,
      '-',
      totBags.toLocaleString('en-IN'),
      totQtls.toFixed(1),
      formatINR(totMill),
      formatINR(totCOGS),
      formatINR(totInflow),
      formatINR(totProfit),
      totQtls > 0 ? `Rs. ${(totProfit / totQtls).toFixed(1)}/Q` : '-',
      '-',
    ],
  ];

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    startY: 65,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineWidth: 0.5,
      lineColor: [203, 213, 225],
    },
    headStyles: {
      fillColor: [43, 108, 176],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      lineWidth: 1,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right', textColor: [185, 28, 28] },
      7: { halign: 'right', textColor: [37, 99, 235], fontStyle: 'bold' },
      8: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
      9: { halign: 'right', fontStyle: 'bold' },
      10: { halign: 'center' },
    },
    margin: { left: 40, right: 40, bottom: 40 },
  });

  doc.save(`Fleet_PnL_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportTrucksPdf(trucks = [], title = 'Inward Trucks Dispatches & Logistics') {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  // Document Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('PROFIT LOSS SOFTWARE - COMMODITY TRADING ERP', 40, 36);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${title} | Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | Total Records: ${trucks.length}`, 40, 52);

  const tableHead = [
    [
      'Serial',
      'Truck Number',
      'Date',
      'PO Contract',
      'Rice Mill / Seller',
      'Bags',
      'Packing',
      'Qtls',
      'Rate/Q',
      'Purchase Outflow',
      'LF/Q',
      'Total LF',
      'LF Advance',
      'Status',
    ],
  ];

  const tableBody = trucks.map((t) => {
    const qtls = Number(t.qty_qtls) || 0;
    const lfRate = Number(t.truck_lf) || 0;
    const totalLf = Math.round(qtls * lfRate);
    const purchasePaid = t.purchase_payment_amount 
      ? Number(t.purchase_payment_amount) 
      : Math.round(Number(t.purchase_amount || 0) * 0.98);

    return [
      t.truck_serial || '-',
      t.truck_number || '-',
      t.unloading_date ? new Date(t.unloading_date).toLocaleDateString('en-IN') : (t.date ? new Date(t.date).toLocaleDateString('en-IN') : '-'),
      t.linked_contract_no || 'Direct',
      t.seller_name || '-',
      Number(t.bags || 0).toLocaleString('en-IN'),
      `${t.kg_per_bag || 30} KG`,
      qtls.toFixed(1),
      Number(t.rate_per_qtl || 0).toLocaleString('en-IN'),
      formatINR(purchasePaid),
      `Rs. ${lfRate}`,
      formatINR(totalLf),
      formatINR(t.lorry_advance || 0),
      t.status || 'UNLOADED',
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 65,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineWidth: 0.5,
      lineColor: [203, 213, 225],
    },
    headStyles: {
      fillColor: [43, 108, 176], // Solid Royal Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'center' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right' },
      9: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
      10: { halign: 'right' },
      11: { halign: 'right' },
      12: { halign: 'right', textColor: [180, 83, 9] },
      13: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: 40, right: 40, bottom: 40 },
  });

  doc.save(`Inward_Trucks_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportSalesPdf(sales = [], title = 'Wholesale Sales Realization Ledger') {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('PROFIT LOSS SOFTWARE - SALES & DISPATCH LEDGER', 40, 36);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${title} | Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | Total Bills: ${sales.length}`, 40, 52);

  const tableHead = [
    [
      'Inv #',
      'Buyer Merchant',
      'Truck Number',
      'Bags',
      'Qty (Q)',
      'Bill Rate',
      'Bill Amount',
      'LF Ded',
      'CD (Discount)',
      'Cutting',
      'Net Bank Received',
      'Payment Date',
      'Brokerage',
    ],
  ];

  const tableBody = sales.map((s) => [
    s.sale_bill_no || '-',
    s.party_name || '-',
    s.truck_number ? `${s.truck_serial} (${s.truck_number})` : '-',
    Number(s.bags || 0).toLocaleString('en-IN'),
    Number(s.qty_qtls || 0).toFixed(1),
    `Rs. ${Number(s.billing_rate || 0).toLocaleString('en-IN')}`,
    formatINR(s.bill_amount),
    formatINR(Math.max(0, Number(s.lorry_amount || 0) - Number(s.lorry_advance || 0))) + (Number(s.lorry_advance) > 0 ? ` (Adv: ${formatINR(s.lorry_advance)})` : ''),
    formatINR(s.discount_amount || 0),
    formatINR(s.cutting_amount || 0),
    formatINR(s.received_amount || s.bill_amount),
    s.sale_received_date ? new Date(s.sale_received_date).toLocaleDateString('en-IN') : 'Pending',
    s.brokerage_amount ? formatINR(s.brokerage_amount) : '-',
  ]);

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 65,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineWidth: 0.5,
      lineColor: [203, 213, 225],
    },
    headStyles: {
      fillColor: [15, 108, 68], // Emerald Green
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right', textColor: [185, 28, 28] },
      8: { halign: 'right', textColor: [185, 28, 28] },
      9: { halign: 'right', textColor: [185, 28, 28] },
      10: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
      11: { halign: 'center' },
      12: { halign: 'right' },
    },
    margin: { left: 40, right: 40, bottom: 40 },
  });

  doc.save(`Wholesale_Sales_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportTruckSettlementReceiptPdf({ truck, sales = [], metrics = {} }) {
  const doc = new jsPDF('portrait', 'pt', 'a4');
  const pageWidth = 595.28;
  const marginX = 36;
  const contentWidth = pageWidth - (marginX * 2); // 523.28 pt

  // ==========================================
  // PAGE 1: INWARD PURCHASE & DIRECT COSTS INVOICE
  // ==========================================

  // Enterprise Header Box
  doc.setFillColor(30, 41, 59); // Slate 900
  doc.rect(marginX, 30, contentWidth, 58, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11); // Amber 400
  doc.text('INWARD PURCHASE & DIRECT COSTS INVOICE (PAGE 1 OF 2)', marginX + 15, 52);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(
    `Official Inward Procurement Bill | Status: ${truck?.status || 'SETTLED'} | Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    marginX + 15,
    70
  );

  // Inward Consignment & Mill Invoice Details Box
  autoTable(doc, {
    startY: 94,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    body: [
      [
        { content: `Mill Inward Bill No:\n${truck?.purchase_bill_no || 'Direct / Under Settle'}`, styles: { fontStyle: 'bold', textColor: [30, 64, 175] } },
        { content: `Rice Mill (Seller):\n${truck?.seller_name || '-'}`, styles: { fontStyle: 'bold' } },
        { content: `PO Contract No:\n${truck?.linked_contract_no || 'Direct Purchase'}`, styles: { fontStyle: 'bold' } },
        { content: `Arrival / Unload Date:\n${truck?.unloading_date ? new Date(truck.unloading_date).toLocaleDateString('en-IN') : (truck?.date ? new Date(truck.date).toLocaleDateString('en-IN') : '-')}` },
      ],
      [
        { content: `Truck Number:\n${truck?.truck_serial || ''} • ${truck?.truck_number || ''}`, styles: { fontStyle: 'bold' } },
        { content: `Quantity / Bags:\n${Number(truck?.qty_qtls || 0).toFixed(1)} Q (${Number(truck?.bags || 0).toLocaleString('en-IN')} Bags)` },
        { content: `Mill Base Rate:\nRs. ${Number(truck?.rate_per_qtl || 0).toLocaleString('en-IN')}/Q` },
        { content: `Driver LF Rate:\nRs. ${Number(truck?.truck_lf || 0)}/Q (Adv: ${formatINR(truck?.lorry_advance || 0)})` },
      ],
    ],
    margin: { left: marginX, right: marginX },
  });

  let currentY = doc.lastAutoTable.finalY + 12;

  const cdPct = truck?.purchase_cd_pct !== null && truck?.purchase_cd_pct !== undefined ? Number(truck.purchase_cd_pct) : 2.0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`1. RICE COMMODITY PURCHASE (MILL INFLOW & -${cdPct}% CD CALCULATION)`, marginX, currentY);

  const purchaseGross = Number(truck?.purchase_amount || 0);
  const cdBenefit = purchaseGross * (cdPct / 100);
  const netPaidMill = Number(metrics?.purchasePaid || (purchaseGross - cdBenefit));

  autoTable(doc, {
    startY: currentY + 5,
    theme: 'grid',
    head: [['Particulars / Description', 'Packing', 'Quantity (Q)', 'Purchase Rate', 'Gross Mill Value', `${cdPct}% Cash Discount (CD)`, 'Net Paid to Mill']],
    body: [
      [
        `Rice Procurement\nBill: ${truck?.purchase_bill_no || 'Direct'}`,
        `${Number(truck?.bags || 0).toLocaleString('en-IN')} Bags`,
        `${Number(truck?.qty_qtls || 0).toFixed(1)} Q`,
        `Rs. ${Number(truck?.rate_per_qtl || 0).toLocaleString('en-IN')}`,
        formatINR(purchaseGross),
        `-${formatINR(cdBenefit)}`,
        formatINR(netPaidMill),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [43, 108, 176], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', textColor: [21, 128, 61], fontStyle: 'bold' },
      6: { halign: 'right', fontStyle: 'bold', textColor: [30, 41, 59] },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // SECTION 2: LORRY EXPENSES (FREIGHT & DRIVER ADVANCE)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('2. LORRY EXPENSES (LORRY FREIGHT & ADVANCE TO DRIVER)', marginX, currentY);

  const totalLF = Number(truck?.qty_qtls || 0) * Number(truck?.truck_lf || 0);
  const lfAdv = Number(truck?.lorry_advance || 0);
  const lfBal = totalLF - lfAdv;

  autoTable(doc, {
    startY: currentY + 5,
    theme: 'grid',
    head: [['Truck Registration', 'Weight Billed', 'LF Rate/Q', 'Total Lorry Freight (LF)', 'LF Cash Advance Paid', 'Balance LF Payable to Driver']],
    body: [
      [
        `${truck?.truck_serial || ''} (${truck?.truck_number || ''})`,
        `${Number(truck?.qty_qtls || 0).toFixed(1)} Quintals`,
        `Rs. ${Number(truck?.truck_lf || 0)} / Qtl`,
        formatINR(totalLF),
        formatINR(lfAdv),
        formatINR(lfBal),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right', textColor: [30, 64, 175] },
      5: { halign: 'right', fontStyle: 'bold', textColor: lfBal > 0 ? [185, 28, 28] : [21, 128, 61] },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // SECTION 3: MANDATORY LEVIES & OPERATING COGS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('3. STATUTORY LEVIES & PACKAGING HANDLING CHARGES', marginX, currentY);

  const leviesBody = [
    ['APMC Mandi Tax / Cess', `0.60% on Wholesale Sales Billed (${formatINR(metrics?.totalBillAmount || 0)})`, formatINR(metrics?.apmcCost || 0)],
    ['Income Tax TDS / TCS', `0.39% on Wholesale Sales Billed`, formatINR(metrics?.itCost || 0)],
    ['Empty Gunny Bags (EGB Packaging)', `${Number(truck?.qty_qtls || 0).toFixed(1)} Q @ Rs. 100/Q`, formatINR(metrics?.egbCost || 0)],
    ['Empty Bags Freight Transportation', `${Number(truck?.qty_qtls || 0).toFixed(1)} Q @ Rs. 20/Q`, formatINR(metrics?.egbTrptCost || 0)],
    ['Selling Brokerage Commission', `Party Negotiated Rate`, formatINR(metrics?.effectiveBrokerageCost || 0)],
  ];

  if (Number(metrics?.purchaseDelayInterest || 0) > 0) {
    leviesBody.push([
      'Mill Delay Financing Charge',
      `${truck?.purchase_gap_days || 0} days capital gap financing`,
      `+${formatINR(metrics?.purchaseDelayInterest || 0)}`,
    ]);
  }

  autoTable(doc, {
    startY: currentY + 5,
    theme: 'grid',
    head: [['Levy / Charge Particulars', 'Calculation Basis / Formula', 'Amount (Rs)']],
    body: leviesBody,
    styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 180 },
      1: { cellWidth: 230 },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = doc.lastAutoTable.finalY + 14;

  // Total Inward Bill Costs Banner
  doc.setFillColor(254, 243, 199); // Amber 100
  doc.setDrawColor(245, 158, 11); // Amber 500
  doc.setLineWidth(1.5);
  doc.roundedRect(marginX, currentY, contentWidth, 38, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15); // Amber 900
  doc.text('TOTAL INWARD PROCUREMENT COSTS (MILL PAID + LEVIES + FREIGHT):', marginX + 12, currentY + 24);

  doc.setFontSize(13);
  doc.setTextColor(185, 28, 28); // Rose 700
  doc.text(formatINR(metrics?.costOfGoods || 0), marginX + contentWidth - 15, currentY + 24, { align: 'right' });

  // Page 1 Signatures Block
  const p1SigY = 740;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, p1SigY, marginX + contentWidth, p1SigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared By: Inward Weighbridge Desk', marginX, p1SigY + 18);
  doc.text('Verified By: Mill Procurement Accounts', marginX + 190, p1SigY + 18);
  doc.text('Authorized Signatory: Partner / Director', marginX + 380, p1SigY + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('PAGE 1 OF 2 — INWARD PURCHASE & DIRECT OUTFLOW BILL', marginX + 160, 805);

  // ==========================================
  // PAGE 2: WHOLESALE SALES REALIZATION & SETTLEMENT PATTI
  // ==========================================
  doc.addPage('a4', 'portrait');

  // Enterprise Header Box for Page 2
  doc.setFillColor(5, 150, 105); // Emerald 600
  doc.rect(marginX, 30, contentWidth, 58, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('WHOLESALE SALES REALIZATION & SETTLEMENT PATTI (PAGE 2 OF 2)', marginX + 15, 52);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 250, 229);
  doc.text(
    `Outward Deliveries Audit & Realized Net Profit | Truck Ref: ${truck?.truck_serial || ''} (${truck?.truck_number || ''}) | Miller: ${truck?.seller_name || '-'}`,
    marginX + 15,
    70
  );

  // Deliveries Table (The full split of the Gross Billed ₹3,54,000!)
  let p2CurrentY = 100;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('1. DELIVERIES & WHOLESALE SALES BREAKDOWN (THE DETAILED BILLS SPLIT)', marginX, p2CurrentY);

  const deliveryHead = [['Bill #', 'Buyer Party Name', 'Bags', 'Qty (Q)', 'Rate/Q', 'LF Ded', 'Gross Bill Amt', 'Received', 'CD Allowed', 'Shortage']];
  const deliveryBody = sales.map((s) => [
    s.sale_bill_no || '-',
    s.party_name || '-',
    Number(s.bags || 0).toLocaleString('en-IN'),
    Number(s.qty_qtls || 0).toFixed(1),
    `Rs. ${Number(s.billing_rate).toLocaleString('en-IN')}`,
    formatINR(Math.max(0, Number(s.lorry_amount || 0) - Number(s.lorry_advance || 0))) + (Number(s.lorry_advance) > 0 ? ` (Adv: ${formatINR(s.lorry_advance)})` : ''),
    formatINR(s.bill_amount),
    formatINR(s.received_amount || s.bill_amount),
    formatINR(s.discount_amount || 0),
    formatINR(s.cutting_amount || 0),
  ]);

  // Delivery Footer Totals Row
  const deliveryFoot = [
    [
      'TOTAL',
      `${sales.length} Dispatched Bills`,
      Number(metrics?.totalBagsSold || 0).toLocaleString('en-IN'),
      `${Number(metrics?.totalQtlsSold || 0).toFixed(1)} Q`,
      '-',
      formatINR(metrics?.totalLorryDeduction || 0),
      formatINR(metrics?.totalBillAmount || 0),
      formatINR(metrics?.totalReceivedAmount || 0),
      formatINR(metrics?.totalDiscount || 0),
      formatINR(metrics?.totalCutting || 0),
    ],
  ];

  autoTable(doc, {
    startY: p2CurrentY + 5,
    head: deliveryHead,
    body: deliveryBody,
    foot: deliveryFoot,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [43, 108, 176], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [30, 64, 175] },
      1: { fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', textColor: [185, 28, 28] },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
      8: { halign: 'right', textColor: [185, 28, 28] },
      9: { halign: 'right', textColor: [185, 28, 28] },
    },
    margin: { left: marginX, right: marginX },
  });

  p2CurrentY = doc.lastAutoTable.finalY + 12;

  // Step 2: Inflow Realization Deductions Audit Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('2. BUYER REALIZATION & DEDUCTION AUDIT (HOW BILLED BECOMES BANK INFLOW)', marginX, p2CurrentY);

  autoTable(doc, {
    startY: p2CurrentY + 5,
    theme: 'grid',
    head: [['Realization & Deduction Step', 'Accounting Note', 'Amount (Rs)']],
    body: [
      ['Gross Deliveries Billed (Total Invoiced to Buyers)', 'Sum of all wholesale bills listed above', formatINR(metrics?.totalBillAmount || 0)],
      ['Less: Cash Discount Allowed (CD)', 'Settlement prompt payment discount', `-${formatINR(metrics?.totalDiscount || 0)}`],
      ['Less: Weight & Quality Shortage Cutting', 'Loss in transit / buyer quality deductions', `-${formatINR(metrics?.totalCutting || 0)}`],
      ['Less: Lorry Freight (LF) Deduction by Buyer', 'Freight settled directly by buyer party', `-${formatINR(metrics?.totalLorryDeduction || 0)}`],
      ['(B) ACTUAL NET CASH RECEIVED IN BANK ACCOUNT', 'Net funds realized into business bank account', formatINR(metrics?.totalReceivedAmount || metrics?.totalBillAmount || 0)],
    ],
    styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 230 },
      1: { cellWidth: 180 },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX },
  });

  p2CurrentY = doc.lastAutoTable.finalY + 12;

  // Step 3: Final Consolidated P&L Audit Statement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('3. FINAL REALIZED CONSOLIDATED PROFIT & LOSS STATEMENT', marginX, p2CurrentY);

  const pnlBody = [
    ['Total Net Cash Received in Bank (Wholesale Sales)', 'Net Realized Inflow (Page 2, Table 2)', formatINR(metrics?.totalReceivedAmount || metrics?.totalBillAmount || 0)],
    ['Less: Total Inward Procurement Costs', 'Mill Rice + LF + Levies (Page 1, Table 1-3)', `-${formatINR(metrics?.costOfGoods || 0)}`],
  ];

  if (Number(metrics?.totalInterestEarned || 0) > 0) {
    pnlBody.push([
      'Plus: 12% p.a. Early Float Interest Gained',
      'Capital deployed interest before mill due date',
      `+${formatINR(metrics?.totalInterestEarned || 0)}`,
    ]);
  }

  pnlBody.push([
    'FINAL REALIZED NET PROFIT / (LOSS)',
    'Realized Bank Cash minus Total Inward Costs',
    formatINR(metrics?.netProfit || 0),
  ]);

  pnlBody.push([
    'REALIZED NET PROFIT PER QUINTAL',
    `Net Profit / ${Number(truck?.qty_qtls || 1).toFixed(1)} Quintals`,
    `Rs. ${(Number(metrics?.netProfit || 0) / Number(truck?.qty_qtls || 1)).toFixed(2)} / Qtl`,
  ]);

  autoTable(doc, {
    startY: p2CurrentY + 5,
    theme: 'grid',
    head: [['Profit & Loss Step', 'Calculation Reference', 'Amount (Rs)']],
    body: pnlBody,
    styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 230 },
      1: { cellWidth: 180 },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX },
  });

  p2CurrentY = doc.lastAutoTable.finalY + 12;

  // Grand Net Profit Banner on Page 2
  const isProfit = Number(metrics?.netProfit || 0) >= 0;
  doc.setFillColor(isProfit ? 5 : 185, isProfit ? 150 : 28, isProfit ? 105 : 28);
  doc.setLineWidth(1.5);
  doc.roundedRect(marginX, p2CurrentY, contentWidth, 38, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`FINAL REALIZED NET PROFIT: ${formatINR(metrics?.netProfit || 0)}`, marginX + 15, p2CurrentY + 24);

  doc.setFontSize(11);
  doc.text(
    `NET PER QUINTAL: Rs. ${(Number(metrics?.netProfit || 0) / Number(truck?.qty_qtls || 1)).toFixed(2)} / Qtl`,
    marginX + contentWidth - 15,
    p2CurrentY + 24,
    { align: 'right' }
  );

  // Page 2 Signatures Block
  const p2SigY = 740;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, p2SigY, marginX + contentWidth, p2SigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared By: Commercial Accounts Officer', marginX, p2SigY + 18);
  doc.text('Audited By: Senior Financial Auditor', marginX + 190, p2SigY + 18);
  doc.text('Authorized Signatory: Managing Partner / Director', marginX + 380, p2SigY + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('PAGE 2 OF 2 — WHOLESALE SALES REALIZATION & NET P&L PATTI', marginX + 140, 805);

  doc.save(`Invoice_Receipt_${truck?.truck_serial || 'Truck'}_${new Date().toISOString().split('T')[0]}.pdf`);
}
