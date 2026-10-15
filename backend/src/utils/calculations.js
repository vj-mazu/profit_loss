// ponytail: lean, exact commodity trading math reverse-engineered from user sheet
// Breakeven matches the Excel 'Summary View' formula exactly:
// ROUNDUP(Purchase + LF + APMC(0.6% x Purchase) + IT(0.39% x Billing) + EGB + EGBTrpt + Delhi + Kasat + CD(5% x Actual) - (2% x Purchase), 0)
export function calculateBreakevenRate({
  purchaseRate = 0,
  lfRate = 0,
  apmcPct = 0.6,
  billingRate = 0,
  actualRate = 0,
  itPct = 0.39,
  egbRate = 100,
  egbTrptRate = 20,
  delhiBrkRate = 60,
  kasatBrkRate = 40,
  cdPct = 5,
  purchaseDiscountPct = 2,
}) {
  const pRate = Number(purchaseRate) || 0;
  const apmcRate = (pRate * Number(apmcPct)) / 100;
  const itRate = ((Number(billingRate) || 0) * Number(itPct)) / 100;
  const cdRate = ((Number(actualRate) || 0) * (Number(cdPct) || 5)) / 100;
  const purchaseCdDeduction = (pRate * (Number(purchaseDiscountPct) || 0)) / 100;

  const total =
    pRate +
    (Number(lfRate) || 0) +
    apmcRate +
    itRate +
    (Number(egbRate) || 0) +
    (Number(egbTrptRate) || 0) +
    (Number(delhiBrkRate) || 0) +
    (Number(kasatBrkRate) || 0) +
    cdRate -
    purchaseCdDeduction;

  // ROUNDUP to a whole rupee, like the sheet's ROUNDUP(x, 0)
  return Math.ceil(total);
}

export function calculateBillFinancials({
  billingRate = 0,
  actualRate = 0,
  qtyQtls = 0,
  truckLfRate = 0,
  purchaseRate = 0,
  masters = {},
}) {
  const apmcPct = masters.apmc_pct !== undefined ? Number(masters.apmc_pct) : 0.6; // default 0.6%
  const itPct = masters.it_tcs_pct !== undefined ? Number(masters.it_tcs_pct) : 0.39; // default 1.3% x 30% = 0.39%
  const cdPct = masters.cd_pct !== undefined ? Number(masters.cd_pct) : 5; // CD = 5% of Actual Rate (dynamic)
  const purchaseDiscountPct = masters.purchase_discount_pct !== undefined ? Number(masters.purchase_discount_pct) : 2; // 2% purchase cash discount

  // Expense ledger (Sheet1 convention): APMC on billing rate
  const apmcRate = Math.round(((Number(billingRate) * apmcPct) / 100) * 100) / 100;
  const itRate = Math.round(((Number(billingRate) * itPct) / 100) * 100) / 100;
  const egbRate = Number(masters.egb_cost_per_qtl || 100);
  const egbTrptRate = Number(masters.egb_trpt_per_qtl || 20);
  const delhiBrkRate = Number(masters.delhi_brokerage_default || 60);
  const kasatBrkRate = Number(masters.kasat_brokerage_default || 40);
  // Dynamic CD: 5% of the actual rate (not a flat rupee default)
  const cdRate = Math.round(((Number(actualRate) * cdPct) / 100) * 100) / 100;

  const breakevenRate = calculateBreakevenRate({
    purchaseRate,
    lfRate: truckLfRate,
    apmcPct,
    billingRate,
    actualRate,
    itPct,
    egbRate,
    egbTrptRate,
    delhiBrkRate,
    kasatBrkRate,
    cdPct,
    purchaseDiscountPct,
  });

  const netRate = Number(billingRate) - Number(truckLfRate);
  const billAmount = Math.round(netRate * Number(qtyQtls) * 100) / 100;
  const lorryAmount = Math.round(Number(truckLfRate) * Number(qtyQtls) * 100) / 100;
  const grossBillAmount = Math.round(Number(billingRate) * Number(qtyQtls) * 100) / 100;

  return {
    billAmount,
    lorryAmount,
    grossBillAmount,
    apmcRate,
    itRate,
    egbRate,
    egbTrptRate,
    delhiBrkRate,
    kasatBrkRate,
    cdRate,
    breakevenRate,
  };
}

export function calculateFloatInterest({
  receivedAmount = 0,
  saleReceivedDate,
  purchasePaymentDate,
  annualRatePct = 12.0,
}) {
  if (!saleReceivedDate || !purchasePaymentDate || !receivedAmount) {
    return { days: 0, interest: 0, type: 'NONE' };
  }

  const dSale = new Date(saleReceivedDate);
  const dPurchase = new Date(purchasePaymentDate);
  const diffTime = dSale.getTime() - dPurchase.getTime();
  const days = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Annual formula: Amount * (Rate% / 100) * Days / 365
  const interest = Math.round(((Number(receivedAmount) * (Number(annualRatePct) / 100) * days) / 365) * 100) / 100;

  // If days < 0, buyer paid earlier than mill payment date -> Interest GAIN
  // If days > 0, buyer paid later than mill payment date -> Interest LOSS
  return {
    days,
    interest,
    type: days < 0 ? 'EARNED' : days > 0 ? 'LOSS' : 'NEUTRAL',
  };
}
