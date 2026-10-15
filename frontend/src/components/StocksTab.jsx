import React, { useState, useEffect } from 'react';
import { Package, Truck, ChevronDown, ChevronUp, Layers, CheckCircle, Clock, Eye, Search } from 'lucide-react';
import api from '../services/api';

export default function StocksTab() {
  const [orders, setOrders] = useState([]);
  const [egbStock, setEgbStock] = useState([]);
  const [bagColors, setBagColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderFilter, setSelectedOrderFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('ORDER_WISE'); // 'ORDER_WISE' or 'GLOBAL'
  
  // Drill-down state: orderId -> list of trucks
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderTrucks, setOrderTrucks] = useState({});
  const [loadingTrucks, setLoadingTrucks] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, mastersRes] = await Promise.all([
        api.getOrders(),
        api.getMasters().catch(() => ({ data: {} })),
      ]);
      setOrders(ordersRes.data?.orders || []);
      setEgbStock(ordersRes.data?.egb_stock || []);
      if (mastersRes.data?.bag_colors?.length > 0) {
        setBagColors(mastersRes.data.bag_colors);
      }
    } catch (err) {
      console.error('Failed to load stocks data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleOrderTrucks = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderTrucks[orderId]) {
      try {
        setLoadingTrucks(true);
        const res = await api.getOrderTrucks(orderId);
        setOrderTrucks((prev) => ({ ...prev, [orderId]: res.data || [] }));
      } catch (err) {
        console.error('Failed to load order trucks', err);
      } finally {
        setLoadingTrucks(false);
      }
    }
  };

  // Compute Overall Totals
  const totalContractedQtls = orders.reduce((sum, o) => sum + (Number(o.qty_qtls) || 0), 0);
  const totalLiftedQtls = orders.reduce((sum, o) => sum + (Number(o.lifted_qtls) || 0), 0);
  const totalRemainingQtls = Math.max(0, totalContractedQtls - totalLiftedQtls);

  // Compute Aggregate Empty Bags by Color
  const colorAggregates = {};
  orders.forEach((o) => {
    const cb = o.color_breakdown || {};
    Object.entries(cb).forEach(([col, data]) => {
      const cleanCol = col.trim();
      if (!colorAggregates[cleanCol]) {
        colorAggregates[cleanCol] = { sent: 0, used: 0, remaining: 0 };
      }
      colorAggregates[cleanCol].sent += Number(data.sent) || 0;
      colorAggregates[cleanCol].used += Number(data.used) || 0;
      colorAggregates[cleanCol].remaining += Math.max(0, (Number(data.sent) || 0) - (Number(data.used) || 0));
    });
  });

  const totalBagsSent = Object.values(colorAggregates).reduce((a, b) => a + b.sent, 0);
  const totalBagsLifted = Object.values(colorAggregates).reduce((a, b) => a + b.used, 0);
  const totalBagsRemaining = Math.max(0, totalBagsSent - totalBagsLifted);

  const filteredOrders = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.contract_no && o.contract_no.toLowerCase().includes(q)) ||
      (o.seller_name && o.seller_name.toLowerCase().includes(q))
    );
  });

  const emptyBagsOrders = orders.filter((o) => {
    if (selectedOrderFilter !== 'ALL' && String(o.id) !== String(selectedOrderFilter)) {
      return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.contract_no && o.contract_no.toLowerCase().includes(q)) ||
      (o.seller_name && o.seller_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-md p-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Stocks & Packaging Inventory Ledger</h1>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Real-time tracking of empty gunny bags by color and contract rice lifting progress with order-to-truck drill-down
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Empty Bags Sent</span>
          <div className="text-xl font-black text-amber-900 mt-1 table-number">
            {totalBagsSent.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">To all partner mills</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 border-l-4 border-l-blue-500 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Bags Lifted</span>
          <div className="text-xl font-black text-blue-900 mt-1 table-number">
            {totalBagsLifted.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Dispatched in trucks</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Bags in Mill Godown</span>
          <div className="text-xl font-black text-emerald-800 mt-1 table-number">
            {totalBagsRemaining.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">Available balance</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 border-l-4 border-l-purple-500 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Ordered Rice</span>
          <div className="text-xl font-black text-purple-900 mt-1 table-number">
            {totalContractedQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Total Qtls contracted</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Lifted Rice</span>
          <div className="text-xl font-black text-indigo-900 mt-1 table-number">
            {totalLiftedQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Dispatched Qtls</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 border-l-4 border-l-rose-500 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Pending Rice</span>
          <div className="text-xl font-black text-rose-800 mt-1 table-number">
            {totalRemainingQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </div>
          <span className="text-[10px] text-rose-600 font-bold">Qtls pending arrival</span>
        </div>
      </div>

      {/* Section 1: Empty Gunny Bags Stock (Order-Wise & By Color) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">
                Empty Bags Stock Ledger (Order-Wise & Brand Colors)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Exact count of empty bags sent to mill, lifted in dispatched trucks, and remaining in mill godown per contract
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setViewMode('ORDER_WISE')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'ORDER_WISE'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 Order-Wise Breakdown
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GLOBAL')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'GLOBAL'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🌐 Global Merged Pool
              </button>
            </div>

            {/* Contract Filter Dropdown */}
            {viewMode === 'ORDER_WISE' && (
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-600">Contract:</span>
                <select
                  value={selectedOrderFilter}
                  onChange={(e) => setSelectedOrderFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">All Contracts ({orders.length})</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.contract_no} - {ord.seller_name} ({Number(ord.qty_qtls || 0).toLocaleString('en-IN')} Q)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {viewMode === 'ORDER_WISE' ? (
          /* Order-Wise Ledger Cards */
          <div className="space-y-4">
            {emptyBagsOrders.length === 0 ? (
              <div className="py-10 text-center text-slate-400 italic">
                No purchase contracts found matching the filter.
              </div>
            ) : (
              emptyBagsOrders.map((ord) => {
                const breakdown = ord.color_breakdown && Object.keys(ord.color_breakdown).length > 0
                  ? ord.color_breakdown
                  : null;

                const ordSent = breakdown
                  ? Object.values(breakdown).reduce((s, d) => s + (Number(d.sent) || 0), 0)
                  : Number(ord.bags_given || 0);

                const ordUsed = breakdown
                  ? Object.values(breakdown).reduce((s, d) => s + (Number(d.used) || 0), 0)
                  : Math.max(0, ordSent - Number(ord.remaining_bags || 0));

                const ordRemaining = Math.max(0, ordSent - ordUsed);
                const ordLiftPercent = ordSent > 0 ? Math.round((ordUsed / ordSent) * 100) : 0;
                const isExpanded = expandedOrderId === ord.id;

                return (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 shadow-2xs overflow-hidden transition-all hover:border-slate-300 hover:shadow-xs"
                  >
                    {/* Contract Header Banner */}
                    <div className="p-3.5 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[#2b6cb0] text-white font-mono font-black text-xs tracking-wider shadow-2xs">
                          {ord.contract_no}
                        </span>
                        <div>
                          <strong className="text-sm font-extrabold text-slate-900 block leading-tight">
                            {ord.seller_name}
                          </strong>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {ord.contract_date ? new Date(ord.contract_date).toLocaleDateString('en-IN') : 'No Date'} • {Number(ord.qty_qtls || 0).toLocaleString('en-IN')} Qtls contracted @ ₹{Number(ord.rate_per_qtl || 0).toLocaleString('en-IN')}/Q • Packing: {ord.kg_per_bag || 30} KG
                          </span>
                        </div>
                      </div>

                      {/* Summary Badges for this Order */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 text-xs font-bold">
                          <span className="text-[10px] text-amber-800 uppercase font-semibold">Sent:</span>
                          <span className="table-number">{ordSent.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-100/80 border border-blue-300 text-blue-950 text-xs font-bold">
                          <span className="text-[10px] text-blue-800 uppercase font-semibold">Lifted:</span>
                          <span className="table-number">{ordUsed.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-950 text-xs font-bold">
                          <span className="text-[10px] text-emerald-800 uppercase font-semibold">In Mill:</span>
                          <span className="table-number font-extrabold">{ordRemaining.toLocaleString('en-IN')}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          ordRemaining === 0 ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white'
                        }`}>
                          {ordRemaining === 0 ? 'Exhausted' : `${ordRemaining} Bal`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleOrderTrucks(ord.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-blue-50 text-blue-700 border border-slate-300 shadow-2xs inline-flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <span>{isExpanded ? 'Hide Trucks' : `Trucks (${Number(ord.trucks_count || 0)})`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Compact Color Badges / Strip for this Specific Order */}
                    <div className="p-2.5">
                      {breakdown && Object.keys(breakdown).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(breakdown).map(([colorName, data]) => {
                            const colorDef = bagColors.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
                            const hex = colorDef?.color_code || '#2563eb';
                            const percent = data.sent > 0 ? Math.round((data.used / data.sent) * 100) : 0;
                            return (
                              <div
                                key={colorName}
                                className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs flex items-center space-x-3 text-xs"
                              >
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block" style={{ backgroundColor: hex }} />
                                  <strong className="font-extrabold text-slate-800 text-[11px] uppercase">{colorName}:</strong>
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-600">
                                  <span>Sent: <strong className="text-slate-900">{data.sent}</strong></span>
                                  <span>•</span>
                                  <span>Lifted: <strong className="text-blue-700">{data.used}</strong></span>
                                  <span>•</span>
                                  <span>Left: <strong className={data.remaining > 0 ? 'text-emerald-700 font-extrabold' : 'text-slate-400'}>{data.remaining}</strong></span>
                                </div>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                  data.remaining === 0 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                  {percent}% Lifted
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                          <span>Total Empty Bags Given: <strong className="text-slate-900">{ordSent.toLocaleString('en-IN')}</strong> | Lifted: <strong className="text-blue-700">{ordUsed.toLocaleString('en-IN')}</strong> | Remaining: <strong className="text-amber-800">{ordRemaining.toLocaleString('en-IN')}</strong></span>
                          <span className="text-[11px] text-slate-400 italic">No color breakdown recorded</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Global Merged Pool View */
          <div>
            {Object.keys(colorAggregates).length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No empty bag records allocated yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(colorAggregates).map(([colorName, data]) => {
                  const colorDef = bagColors.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
                  const hex = colorDef?.color_code || '#2563eb';
                  const percentLifted = data.sent > 0 ? Math.round((data.used / data.sent) * 100) : 0;
                  return (
                    <div
                      key={colorName}
                      className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 transition-all hover:bg-white hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block" style={{ backgroundColor: hex }} />
                          <span className="font-extrabold text-sm text-slate-900">{colorName}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          data.remaining === 0 ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {data.remaining === 0 ? 'Exhausted' : `${data.remaining} In Mill`}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Sent</span>
                          <strong className="text-slate-800 table-number">{data.sent.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Lifted</span>
                          <strong className="text-blue-800 table-number">{data.used.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Left</span>
                          <strong className="text-amber-800 table-number">{data.remaining.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, percentLifted)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Lifted: {percentLifted}%</span>
                        <span>Remaining: {100 - percentLifted}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Contracts & Order Drill-Down to Trucks */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Order Contracts & Lifted Trucks Drill-Down
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Click any Contract Number (e.g. PO-01) to instantly expand all trucks dispatched under that order
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search contract or mill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-semibold bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs grid-table">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold text-[11px] uppercase tracking-wider border-b-2 border-blue-900">
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center w-12">#</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Contract No</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Rice Mill / Seller</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Contract Date</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Ordered Qtls</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Lifted Qtls</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Pending Qtls</th>
                <th className="py-2.5 px-3 text-right border-r border-blue-400/40">Bags Left at Mill</th>
                <th className="py-2.5 px-3 text-center border-r border-blue-400/40">Trucks Lifted</th>
                <th className="py-2.5 px-3 text-center">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="font-medium text-slate-700 divide-y divide-slate-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400 italic">
                    No matching purchase contracts found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o, idx) => {
                  const isExpanded = expandedOrderId === o.id;
                  const rowBg = idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/60';
                  const contractedQtls = Number(o.qty_qtls) || 0;
                  const liftedQtls = Number(o.lifted_qtls) || 0;
                  const pendingQtls = Math.max(0, contractedQtls - liftedQtls);
                  const trucks = orderTrucks[o.id] || [];

                  return (
                    <React.Fragment key={o.id}>
                      <tr className={`${rowBg} transition-colors cursor-pointer`} onClick={() => handleToggleOrderTrucks(o.id)}>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500 border-r border-b border-slate-300">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 border-r border-b border-slate-300">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 font-mono font-bold border border-blue-200 inline-flex items-center space-x-1">
                            <span>{o.contract_no}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-b border-slate-300">
                          {o.seller_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 border-r border-b border-slate-300">
                          {o.contract_date ? new Date(o.contract_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black table-number text-slate-900 border-r border-b border-slate-300">
                          {contractedQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black table-number text-blue-900 border-r border-b border-slate-300">
                          {liftedQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black table-number border-r border-b border-slate-300">
                          <span className={pendingQtls === 0 ? 'text-emerald-700' : 'text-amber-800'}>
                            {pendingQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right table-number font-bold text-amber-900 border-r border-b border-slate-300">
                          {Number(o.remaining_bags || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-b border-slate-300">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                            {Number(o.trucks_count || 0)} Trucks
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center border-b border-slate-300">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleOrderTrucks(o.id);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-blue-50 text-blue-700 border border-slate-300 shadow-2xs inline-flex items-center space-x-1 transition-colors cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Trucks' : 'View Trucks'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Order Trucks Drill-Down Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="10" className="p-0 bg-blue-50/50 border-b-2 border-blue-300">
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Truck className="w-4 h-4 text-blue-700" />
                                  <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                                    Trucks Lifted Under Contract {o.contract_no} ({o.seller_name})
                                  </h3>
                                </div>
                                <span className="text-[11px] font-bold text-blue-800">
                                  Total {trucks.length} Trucks Loaded
                                </span>
                              </div>

                              {loadingTrucks ? (
                                <p className="text-xs text-slate-500 italic py-4 text-center">Loading lifted trucks...</p>
                              ) : trucks.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-3 text-center bg-white rounded-lg border border-blue-100">
                                  No trucks have been dispatched yet under this contract.
                                </p>
                              ) : (
                                <div className="overflow-x-auto bg-white rounded-xl border border-blue-200 shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                                        <th className="py-2 px-3">Truck Serial</th>
                                        <th className="py-2 px-3">Registration No</th>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3 text-right">Bags Loaded</th>
                                        <th className="py-2 px-3 text-right">Weight (Qtls)</th>
                                        <th className="py-2 px-3 text-right">Purchase Rate</th>
                                        <th className="py-2 px-3 text-right">Agreed LF Rate</th>
                                        <th className="py-2 px-3 text-right">Diesel Advance</th>
                                        <th className="py-2 px-3 text-right">Balance LF to Driver</th>
                                        <th className="py-2 px-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                      {trucks.map((t) => {
                                        const tQtls = Number(t.qty_qtls) || 0;
                                        const lfRate = Number(t.truck_lf) || 0;
                                        const totalLf = Math.round(lfRate * tQtls);
                                        const advance = Number(t.lorry_advance) || 0;
                                        const balLf = Math.max(0, totalLf - advance);
                                        return (
                                          <tr key={t.id} className="hover:bg-blue-50/30">
                                            <td className="py-2 px-3 font-bold text-slate-900">{t.truck_serial}</td>
                                            <td className="py-2 px-3 font-mono font-bold text-blue-900">{t.truck_number}</td>
                                            <td className="py-2 px-3">{t.date ? new Date(t.date).toLocaleDateString('en-IN') : '-'}</td>
                                            <td className="py-2 px-3 text-right font-bold table-number">
                                              {Number(t.bags).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold table-number">
                                              {tQtls.toFixed(1)}
                                            </td>
                                            <td className="py-2 px-3 text-right table-number font-semibold">
                                              ₹{Number(t.rate_per_qtl).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-2 px-3 text-right table-number font-semibold text-blue-900">
                                              ₹{lfRate}/Q <span className="text-[10px] text-slate-400 font-normal">(₹{totalLf.toLocaleString('en-IN')})</span>
                                            </td>
                                            <td className="py-2 px-3 text-right table-number font-semibold text-amber-800">
                                              {advance > 0 ? `₹${advance.toLocaleString('en-IN')}` : '-'}
                                            </td>
                                            <td className="py-2 px-3 text-right table-number font-black text-slate-900">
                                              ₹{balLf.toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                {t.status || 'UNLOADED'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
