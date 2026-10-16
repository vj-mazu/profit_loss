import React, { useState, useEffect } from 'react';
import { DollarSign, FileSpreadsheet, Search, Filter, Calculator, Layers, Receipt } from 'lucide-react';
import api from '../services/api';

export default function ExpendituresTab() {
  const [orders, setOrders] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, trucksRes, salesRes, mastersRes] = await Promise.all([
        api.getOrders(),
        api.getTrucks({ limit: 500 }),
        api.getSales({ limit: 500 }),
        api.getMasters().catch(() => ({ data: {} })),
      ]);

      setOrders(ordersRes.data?.orders || []);
      setTrucks(trucksRes.data?.data || (Array.isArray(trucksRes.data) ? trucksRes.data : []));
      setSales(salesRes.data?.data || (Array.isArray(salesRes.data) ? salesRes.data : []));
      if (mastersRes.data?.system_settings) {
        setSettings(mastersRes.data.system_settings);
      }
    } catch (err) {
      console.error('Failed to load expenditures data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute expenses per order
  const orderExpenses = orders.map((o) => {
    const contractedQtls = Number(o.qty_qtls) || 0;
    const liftedQtls = Number(o.lifted_qtls) || 0;
    const effectiveQtls = liftedQtls > 0 ? liftedQtls : contractedQtls;

    // 1. Empty Gunny Bags Cost (Manual per-order rate, fallback to master or 100)
    const egbRate = Number(o.egb_rate_per_qtl !== undefined && o.egb_rate_per_qtl !== null ? o.egb_rate_per_qtl : (settings.egb_cost_per_qtl || 100));
    const egbCost = Math.round(effectiveQtls * egbRate);

    // 2. Bags Transport Freight (Tempo/bus)
    const egbTrptCost = Number(o.bag_transport_cost || 0);

    // 3. Inward Trucks Freight (LF) - Mill -> Depot / Godown
    const linkedTrucks = trucks.filter((t) => Number(t.order_id) === Number(o.id));
    const totalLfFreight = linkedTrucks.reduce((sum, t) => {
      const tQtls = Number(t.qty_qtls) || 0;
      const lfRate = Number(t.truck_lf) || 0;
      return sum + Math.round(tQtls * lfRate);
    }, 0);

    const totalLorryAdvance = linkedTrucks.reduce((sum, t) => sum + (Number(t.lorry_advance) || 0), 0);
    const balanceLfPayable = Math.max(0, totalLfFreight - totalLorryAdvance);

    // 4. Sales Delivery Lorry Freight (LF) - Depot -> Wholesale Buyers
    const linkedTruckIds = new Set(linkedTrucks.map((t) => Number(t.id)));
    const linkedSales = sales.filter((s) => linkedTruckIds.has(Number(s.truck_id)));
    const totalSalesLf = linkedSales.reduce((sum, s) => {
      const sQtls = Number(s.qty_qtls) || 0;
      const lfRate = Number(s.lf_rate) || 0;
      const lorryAmt = s.lorry_amount !== null && s.lorry_amount !== undefined && Number(s.lorry_amount) > 0
        ? Number(s.lorry_amount)
        : Math.round(sQtls * lfRate);
      return sum + lorryAmt;
    }, 0);

    const totalSalesLfAdvance = linkedSales.reduce((sum, s) => sum + (Number(s.lorry_advance) || 0), 0);
    const totalSalesLfBalance = linkedSales.reduce((sum, s) => {
      const sQtls = Number(s.qty_qtls) || 0;
      const lfRate = Number(s.lf_rate) || 0;
      const lorryAmt = s.lorry_amount !== null && s.lorry_amount !== undefined && Number(s.lorry_amount) > 0
        ? Number(s.lorry_amount)
        : Math.round(sQtls * lfRate);
      const adv = Number(s.lorry_advance) || 0;
      return sum + Math.max(0, lorryAmt - adv);
    }, 0);

    // 5. Mandi APMC Tax (0.60% of purchase or billing)
    const apmcPct = settings.apmc_pct !== undefined ? Number(settings.apmc_pct) : 0.6;
    const purchaseVal = linkedTrucks.reduce((sum, t) => sum + (Number(t.purchase_amount) || 0), 0) || (contractedQtls * (Number(o.rate_per_qtl) || 0));
    const apmcCost = Math.round(purchaseVal * (apmcPct / 100));

    // 6. IT / TCS (0.39%)
    const itTcsPct = settings.it_tcs_pct !== undefined ? Number(settings.it_tcs_pct) : 0.39;
    const itTcsCost = Math.round(purchaseVal * (itTcsPct / 100));

    // 7. Brokerages (Inward Buying Brokerage + Selling Brokerage)
    const buyerBrokerageRate = o.buying_brokerage_per_qtl !== undefined && o.buying_brokerage_per_qtl !== null && Number(o.buying_brokerage_per_qtl) > 0
      ? Number(o.buying_brokerage_per_qtl)
      : (Number(settings.delhi_brokerage_default) || 0);
    const sellerBrokerageRate = Number(settings.kasat_brokerage_default || 40);
    const totalBrokerage = Math.round(effectiveQtls * (buyerBrokerageRate + sellerBrokerageRate));

    // Total Operating Expenses (Direct procurement & inbound landed cost + levies + brokerage)
    const grandTotalExpense = egbCost + egbTrptCost + totalLfFreight + apmcCost + itTcsCost + totalBrokerage;
    const expensePerQtl = effectiveQtls > 0 ? Math.round((grandTotalExpense / effectiveQtls) * 100) / 100 : 0;

    return {
      order: o,
      contractedQtls,
      liftedQtls,
      effectiveQtls,
      egbRate,
      egbCost,
      egbTrptCost,
      totalLfFreight,
      totalLorryAdvance,
      balanceLfPayable,
      totalSalesLf,
      totalSalesLfAdvance,
      totalSalesLfBalance,
      apmcCost,
      itTcsCost,
      buyerBrokerageRate,
      sellerBrokerageRate,
      totalBrokerage,
      grandTotalExpense,
      expensePerQtl,
      trucksCount: linkedTrucks.length,
      salesCount: linkedSales.length,
    };
  });

  // Aggregates
  const totalEgbCost = orderExpenses.reduce((s, e) => s + e.egbCost, 0);
  const totalEgbTrpt = orderExpenses.reduce((s, e) => s + e.egbTrptCost, 0);
  const totalInwardLf = orderExpenses.reduce((s, e) => s + e.totalLfFreight, 0);
  const totalInwardLfAdvance = orderExpenses.reduce((s, e) => s + e.totalLorryAdvance, 0);
  const totalInwardLfBalance = orderExpenses.reduce((s, e) => s + e.balanceLfPayable, 0);

  const totalSalesLf = orderExpenses.reduce((s, e) => s + e.totalSalesLf, 0);
  const totalSalesLfAdvance = orderExpenses.reduce((s, e) => s + e.totalSalesLfAdvance, 0);
  const totalSalesLfBalance = orderExpenses.reduce((s, e) => s + e.totalSalesLfBalance, 0);

  const totalApmc = orderExpenses.reduce((s, e) => s + e.apmcCost, 0);
  const totalBrokerage = orderExpenses.reduce((s, e) => s + e.totalBrokerage, 0);
  const totalItTcs = orderExpenses.reduce((s, e) => s + e.itTcsCost, 0);
  const grandTotal = orderExpenses.reduce((s, e) => s + e.grandTotalExpense, 0);

  const filteredExpenses = orderExpenses.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (e.order.contract_no && e.order.contract_no.toLowerCase().includes(q)) ||
      (e.order.seller_name && e.order.seller_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-md p-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-800">
              <DollarSign className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Consolidated Expenditures & Operating Costs</h1>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Complete cost auditing per order: Inward LF (Mill → Depot), Sales Delivery LF (Depot → Buyer), Empty Gunny Bags, Transport, Mandi Taxes, TCS, and Brokerages
          </p>
        </div>
      </div>

      {/* Two LF Channels Explanation Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-xs border border-blue-800">
        <div className="flex items-center space-x-2 text-amber-300 font-extrabold text-xs uppercase tracking-wider mb-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Two Separate Lorry Freight (LF) Channels & Advance Splits</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/15">
            <div className="font-bold text-blue-200 flex items-center space-x-1.5 mb-1">
              <span>🚚 1. Inward Lorry Freight (Mill → Depot / Godown):</span>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed">
              Incurred when bringing rice from UP/MP mills to Delhi godown. Total LF = <strong className="text-amber-300">Advance Paid at Mill</strong> + <strong className="text-emerald-300">Driver Balance Paid at Unloading</strong>. This forms part of the direct procurement landed cost.
            </p>
          </div>
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/15">
            <div className="font-bold text-sky-200 flex items-center space-x-1.5 mb-1">
              <span>🚛 2. Sales Delivery Freight (Depot → Wholesale Buyer):</span>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed">
              Incurred when delivering stock to wholesale buyers. Total LF = <strong className="text-amber-300">Seller Advance Paid</strong> + <strong className="text-sky-300">Driver Balance Paid by Buyer</strong>. The buyer pays the driver the balance upon delivery and deducts only that balance from your bill, reimbursing your advance.
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {/* Row 1 */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Empty Bags Cost</span>
          <div className="text-base font-black text-amber-900 mt-1 table-number">
            ₹{totalEgbCost.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Bags purchased</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-orange-500 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Bags Transport</span>
          <div className="text-base font-black text-orange-900 mt-1 table-number">
            ₹{totalEgbTrpt.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Tempo/bus freight</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-blue-600 shadow-2xs">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-blue-900 uppercase block">Inward LF (Mill → Depot)</span>
            <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">Inward</span>
          </div>
          <div className="text-base font-black text-blue-950 mt-1 table-number">
            ₹{totalInwardLf.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-600 mt-0.5">
            <span className="font-bold text-amber-800">Adv: ₹{totalInwardLfAdvance.toLocaleString('en-IN')}</span>
            <span>•</span>
            <span className="font-bold text-blue-800">Bal: ₹{totalInwardLfBalance.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-sky-500 shadow-2xs">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-sky-900 uppercase block">Sales Delivery LF</span>
            <span className="text-[9px] font-black bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded">Outward</span>
          </div>
          <div className="text-base font-black text-sky-950 mt-1 table-number">
            ₹{totalSalesLf.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] text-slate-600 mt-0.5">
            <span className="font-bold text-amber-800">Adv: ₹{totalSalesLfAdvance.toLocaleString('en-IN')}</span>
            <span>•</span>
            <span className="font-bold text-sky-800">Buyer: ₹{totalSalesLfBalance.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Row 2 */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">APMC Mandi Tax</span>
          <div className="text-base font-black text-emerald-800 mt-1 table-number">
            ₹{totalApmc.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Standard 0.60%</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Income Tax / TCS</span>
          <div className="text-base font-black text-indigo-900 mt-1 table-number">
            ₹{totalItTcs.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Standard 0.39%</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-purple-500 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Brokerage</span>
          <div className="text-base font-black text-purple-900 mt-1 table-number">
            ₹{totalBrokerage.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Buyer + Mill</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 border-l-4 border-l-rose-600 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total All Expenses</span>
          <div className="text-base font-black text-rose-800 mt-1 table-number">
            ₹{grandTotal.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-rose-600 font-bold">Consolidated cost</span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-purple-700" />
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Order-Wise Detailed Costing Sheet & LF Splits
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live breakdown of all operational expenses per contract with separated Inward LF and Sales Delivery LF
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search contract or mill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-semibold bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs grid-table">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold text-[11px] uppercase tracking-wider border-b-2 border-blue-900">
                <th className="py-2.5 px-3 border-r border-blue-400/40">Contract No</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Rice Mill / Seller</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Lifted / Qty (Q)</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">EGB Bags Cost</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Bags Transport</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40 bg-blue-800/80">Inward LF (Mill → Depot)</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40 bg-sky-800/80">Sales Delivery LF</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">APMC Mandi Tax</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">TCS (0.39%)</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Brokerage</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Total Order Expenses</th>
                <th className="py-2.5 px-3 text-right">Cost / Qtl</th>
              </tr>
            </thead>
            <tbody className="font-medium text-slate-700 divide-y divide-slate-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-12 text-center text-slate-400 italic">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e, idx) => {
                  const rowBg = idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/60';
                  return (
                    <tr key={e.order.id} className={`${rowBg} transition-colors`}>
                      <td className="py-2.5 px-3 font-black text-slate-900 border-r border-b border-slate-300">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 font-mono font-bold border border-blue-200">
                          {e.order.contract_no}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-b border-slate-300">
                        {e.order.seller_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold table-number text-slate-900 border-r border-b border-slate-300">
                        {e.effectiveQtls.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">Qtls</span>
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-amber-900 border-r border-b border-slate-300">
                        ₹{e.egbCost.toLocaleString('en-IN')}
                        <span className="block text-[9px] text-amber-700 font-normal">(@₹{e.egbRate}/Q)</span>
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-semibold text-orange-900 border-r border-b border-slate-300">
                        {e.egbTrptCost > 0 ? `₹${e.egbTrptCost.toLocaleString('en-IN')}` : '-'}
                      </td>
                      
                      {/* Inward LF Split */}
                      <td className="py-2.5 px-3 text-right table-number font-bold text-blue-950 border-r border-b border-slate-300 bg-blue-50/30">
                        <div>₹{e.totalLfFreight.toLocaleString('en-IN')}</div>
                        {e.totalLfFreight > 0 && (
                          <div className="text-[9px] space-x-1 font-normal text-slate-600">
                            <span className="text-amber-800 font-semibold">Adv: ₹{e.totalLorryAdvance.toLocaleString('en-IN')}</span>
                            <span>•</span>
                            <span className="text-blue-800 font-semibold">Bal: ₹{e.balanceLfPayable.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </td>

                      {/* Sales Delivery LF Split */}
                      <td className="py-2.5 px-3 text-right table-number font-bold text-sky-950 border-r border-b border-slate-300 bg-sky-50/30">
                        {e.totalSalesLf > 0 ? (
                          <>
                            <div>₹{e.totalSalesLf.toLocaleString('en-IN')}</div>
                            <div className="text-[9px] space-x-1 font-normal text-slate-600">
                              <span className="text-amber-800 font-semibold">Adv: ₹{e.totalSalesLfAdvance.toLocaleString('en-IN')}</span>
                              <span>•</span>
                              <span className="text-sky-800 font-semibold">Buyer: ₹{e.totalSalesLfBalance.toLocaleString('en-IN')}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right table-number font-semibold text-emerald-800 border-r border-b border-slate-300">
                        ₹{e.apmcCost.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-semibold text-indigo-900 border-r border-b border-slate-300">
                        ₹{e.itTcsCost.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-semibold text-purple-900 border-r border-b border-slate-300">
                        ₹{e.totalBrokerage.toLocaleString('en-IN')}
                        <span className="block text-[9px] text-purple-600 font-normal">
                          Buy: ₹{e.buyerBrokerageRate} + Sell: ₹{e.sellerBrokerageRate}/Q
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-black text-rose-800 border-r border-b border-slate-300 bg-rose-50/40">
                        ₹{e.grandTotalExpense.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-slate-900 border-b border-slate-300">
                        ₹{e.expensePerQtl.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                  <td colSpan="3" className="py-2.5 px-3 text-right uppercase text-[10px] tracking-wider border-r border-slate-300">
                    Grand Total Expenses:
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-amber-900">
                    ₹{totalEgbCost.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-orange-900">
                    ₹{totalEgbTrpt.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-blue-950 bg-blue-50/50">
                    <div>₹{totalInwardLf.toLocaleString('en-IN')}</div>
                    <div className="text-[9px] font-normal text-slate-600">
                      Adv: ₹{totalInwardLfAdvance.toLocaleString('en-IN')} • Bal: ₹{totalInwardLfBalance.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-sky-950 bg-sky-50/50">
                    <div>₹{totalSalesLf.toLocaleString('en-IN')}</div>
                    <div className="text-[9px] font-normal text-slate-600">
                      Adv: ₹{totalSalesLfAdvance.toLocaleString('en-IN')} • Buyer: ₹{totalSalesLfBalance.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-emerald-900">
                    ₹{totalApmc.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-indigo-900">
                    ₹{totalItTcs.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-purple-900">
                    ₹{totalBrokerage.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right table-number border-r border-slate-300 text-rose-900 bg-rose-100/70">
                    ₹{grandTotal.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right table-number text-slate-800">
                    ₹{orderExpenses.reduce((s, e) => s + e.effectiveQtls, 0) > 0 ? (grandTotal / orderExpenses.reduce((s, e) => s + e.effectiveQtls, 0)).toFixed(2) : '0.00'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
