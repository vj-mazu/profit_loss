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
  lfRate = null,
  lorryAdvance = 0,
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

  const effectiveLfRate = lfRate !== null && lfRate !== undefined && lfRate !== '' ? Number(lfRate) : Number(truckLfRate || 0);
  const effectiveAdvance = Number(lorryAdvance || 0);

  const breakevenRate = calculateBreakevenRate({
    purchaseRate,
    lfRate: effectiveLfRate,
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

  const totalLorryAmount = Math.round(Number(effectiveLfRate) * Number(qtyQtls) * 100) / 100;
  const lorryBalance = Math.max(0, Math.round((totalLorryAmount - effectiveAdvance) * 100) / 100);
  const grossBillAmount = Math.round(Number(billingRate) * Number(qtyQtls) * 100) / 100;
  // Net Bill Amount payable by buyer to seller:
  // Buyer pays driver only the balance LF upon arrival.
  // Therefore, buyer deducts ONLY lorry balance (if seller paid advance, buyer pays that advance extra to seller!)
  const billAmount = Math.round((grossBillAmount - lorryBalance) * 100) / 100;

  return {
    billAmount,
    lorryAmount: totalLorryAmount,
    lorryAdvance: effectiveAdvance,
    lorryBalance,
    effectiveLfRate,
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

export function calculateMultiPaymentInterest({
  payments = [],
  purchasePaymentDate,
  annualRatePct = 12.0,
}) {
  if (!Array.isArray(payments) || payments.length === 0) {
    return {
      totalReceived: 0,
      totalInterestEarned: 0,
      totalInterestLoss: 0,
      netInterest: 0,
      interestType: 'NONE',
      enrichedPayments: [],
    };
  }

  let totalReceived = 0;
  let totalInterestEarned = 0;
  let totalInterestLoss = 0;

  const enrichedPayments = payments.map((p) => {
    const amt = Number(p.amount || 0);
    totalReceived += amt;

    if (!p.date || !purchasePaymentDate || amt <= 0) {
      return {
        ...p,
        amount: amt,
        interest_days: 0,
        interest_amount: 0,
        interest_type: 'NONE',
      };
    }

    const float = calculateFloatInterest({
      receivedAmount: amt,
      saleReceivedDate: p.date,
      purchasePaymentDate,
      annualRatePct,
    });

    if (float.type === 'EARNED') {
      totalInterestEarned += Math.abs(float.interest);
    } else if (float.type === 'LOSS') {
      totalInterestLoss += Math.abs(float.interest);
    }

    return {
      ...p,
      amount: amt,
      interest_days: float.days,
      interest_amount: Math.abs(float.interest),
      interest_type: float.type,
    };
  });

  const netInterest = Math.round((totalInterestEarned - totalInterestLoss) * 100) / 100;
  const interestType = netInterest > 0 ? 'EARNED' : netInterest < 0 ? 'LOSS' : 'NONE';

  return {
    totalReceived: Math.round(totalReceived * 100) / 100,
    totalInterestEarned: Math.round(totalInterestEarned * 100) / 100,
    totalInterestLoss: Math.round(totalInterestLoss * 100) / 100,
    netInterest,
    interestType,
    enrichedPayments,
  };
}
