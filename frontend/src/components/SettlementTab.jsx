import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Percent, 
  ArrowDownRight, 
  ArrowUpRight, 
  DollarSign,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  ArrowLeft,
  Receipt,
  Truck,
  TrendingUp,
  Printer,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import api from '../services/api';
import FilterBar from './FilterBar';
import { exportTruckSettlementReceiptPdf, exportFleetPdf } from '../utils/pdfExport';

export default function SettlementTab({ selectedTruckId }) {
  const [viewMode, setViewMode] = useState('FLEET_SUMMARY'); // 'FLEET_SUMMARY' or 'TRUCK_AUDIT'
  const [trucks, setTrucks] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogicGuide, setShowLogicGuide] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  // Mill Payment update state
  const [purchasePaymentDate, setPurchasePaymentDate] = useState('');
  const [purchasePaymentAmount, setPurchasePaymentAmount] = useState('');
  const [purchasePaymentMode, setPurchasePaymentMode] = useState('RTGS/NEFT');
  const [purchasePaymentRef, setPurchasePaymentRef] = useState('');
  const [saleAmountReceivedDate, setSaleAmountReceivedDate] = useState('');

  const loadTrucksList = async (targetTruckId = null) => {
    try {
      setLoading(true);
      const res = await api.getSettlementSummary();
      const list = Array.isArray(res.data) ? res.data : [];
      setTrucks(list);

      const activeId = targetTruckId || selectedTruckId;
      if (activeId) {
        setViewMode('TRUCK_AUDIT');
        loadSettlement(activeId);
      } else if (list.length > 0) {
        loadSettlement(list[0].id, false);
      }
    } catch (err) {
      console.error('Failed to load settlement list', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSettlement = async (truckId, switchView = true) => {
    try {
      setLoading(true);
      const res = await api.getTruckSettlement(truckId);
      setSettlementData(res.data);
      setSelectedTruck(res.data.truck);
      setPurchasePaymentDate(
        res.data.truck.purchase_payment_date
          ? new Date(res.data.truck.purchase_payment_date).toISOString().split('T')[0]
          : ''
      );
      setPurchasePaymentAmount(res.data.truck.purchase_payment_amount || '');
      setPurchasePaymentMode(res.data.truck.purchase_payment_mode || 'RTGS/NEFT');
      setPurchasePaymentRef(res.data.truck.purchase_payment_ref || '');
      setSaleAmountReceivedDate(
        res.data.truck.sale_amount_received_date
          ? new Date(res.data.truck.sale_amount_received_date).toISOString().split('T')[0]
          : ''
      );
      if (switchView) {
        setViewMode('TRUCK_AUDIT');
      }
    } catch (err) {
      console.error('Failed to load settlement', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrucksList(selectedTruckId);
  }, [selectedTruckId]);

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!selectedTruck) return;
    try {
      await api.updateTruckPayment(selectedTruck.id, {
        purchase_payment_date: purchasePaymentDate || null,
        purchase_payment_amount: purchasePaymentAmount || null,
        purchase_payment_mode: purchasePaymentMode || null,
        purchase_payment_ref: purchasePaymentRef || null,
        sale_amount_received_date: saleAmountReceivedDate || null,
        status: 'SETTLED',
      });
      await loadSettlement(selectedTruck.id, false);
      // Also reload summary list
      const res = await api.getSettlementSummary();
      setTrucks(Array.isArray(res.data) ? res.data : []);
      alert('Payment settlement updated successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment settlement');
    }
  };

  const { truck, sales = [], metrics = {} } = settlementData || {};

  // Compute fleet level KPIs
  const totalFleetPurchases = trucks.reduce((sum, t) => sum + Number(t.purchase_amount || 0), 0);
  const totalFleetInflows = trucks.reduce((sum, t) => sum + Number(t.effective_inflow || 0), 0);
  const totalFleetCOGS = trucks.reduce((sum, t) => sum + Number(t.cost_of_goods || 0), 0);
  const settledTrucks = trucks.filter((t) => t.net_profit !== null && t.net_profit !== undefined);
  const totalFleetNetProfit = settledTrucks.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
  const totalFleetQtls = settledTrucks.reduce((sum, t) => sum + Number(t.qty_qtls || 0), 0);
  const avgFleetProfitPerQtl = totalFleetQtls > 0 ? totalFleetNetProfit / totalFleetQtls : 0;

  // Filter trucks for table
  const filteredTrucks = trucks.filter((t) => {
    const s = search.toLowerCase().trim();
    const matchSearch = !s || 
      t.truck_serial?.toLowerCase().includes(s) ||
      t.truck_number?.toLowerCase().includes(s) ||
      t.seller_name?.toLowerCase().includes(s) ||
      t.linked_contract_no?.toLowerCase().includes(s);
    const matchStatus = status === 'ALL' || t.status === status;
    return matchSearch && matchStatus;
  });

  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'UNLOADED', label: 'Unloaded (Received)' },
    { value: 'SETTLED', label: 'Settled (Approved Admin)' },
  ];

  // Helper to set 2% CD directly
  const handleAutoFill2PercentCD = () => {
    if (truck?.purchase_amount) {
      const netAmount = Math.round(Number(truck.purchase_amount) * 0.98 * 100) / 100;
      setPurchasePaymentAmount(String(netAmount));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Financial Settlement & Audit Ledger</h1>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Mill procurement COGS breakdown, wholesale merchant inflows, 12% p.a. float interest engine, and net realized profit
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('FLEET_SUMMARY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'FLEET_SUMMARY'
                  ? 'bg-[#2b6cb0] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fleet P&L Table</span>
            </button>
            <button
              onClick={() => setViewMode('TRUCK_AUDIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'TRUCK_AUDIT'
                  ? 'bg-[#2b6cb0] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Single Truck Audit</span>
            </button>
          </div>

          <button
            onClick={() => setShowLogicGuide(!showLogicGuide)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Formulas</span>
            {showLogicGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Logic Guide Accordion */}
      {showLogicGuide && (
        <div className="bg-[#0f172a] text-white p-6 rounded-2xl border-2 border-slate-700 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-emerald-400 font-black text-sm">
            <Info className="w-5 h-5 text-emerald-400" />
            <span>Complete Profit & Loss Calculation Accounting Rules (Profit Loss Software)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-600 shadow-xs">
              <span className="font-extrabold text-emerald-400 text-sm block mb-1.5">1. Mill Purchase Outflow (-2% CD)</span>
              <p className="text-slate-200 leading-relaxed font-medium">
                Truck arrives with Bags (e.g. 25, 26, 30, or 50 KG). Total Qty (Qtls) = <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">(Bags × KG) / 100</code>.
                <br /><br />
                Base invoice value = <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">Qty × Rate</code>.
                <br /><br />
                Net Payment to Mill with <strong className="text-emerald-300 font-bold">2% Cash Discount (CD)</strong> deducted = <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300">Invoice × 0.98</code>.
              </p>
            </div>

            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-600 shadow-xs">
              <span className="font-extrabold text-amber-400 text-sm block mb-1.5">2. Mandatory Levies & Direct COGS</span>
              <p className="text-slate-200 leading-relaxed font-medium">
                Cost of Goods Sold (COGS) absorbs:
                <br />• <strong className="text-white font-bold">APMC Mandi Tax:</strong> 0.60% on wholesale sales
                <br />• <strong className="text-white font-bold">IT TDS / TCS:</strong> 0.39% on wholesale sales
                <br />• <strong className="text-white font-bold">Empty Gunny Bags (EGB):</strong> ₹100 / Qtl
                <br />• <strong className="text-white font-bold">EGB Freight Transport:</strong> ₹20 / Qtl
                <br />• <strong className="text-white font-bold">Brokerages:</strong> Party negotiated rate (e.g. ₹30, ₹50, ₹60/Qtl, or standard)
              </p>
            </div>

            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-600 shadow-xs">
              <span className="font-extrabold text-blue-400 text-sm block mb-1.5">3. 12% p.a. Cash Float Engine</span>
              <p className="text-slate-200 leading-relaxed font-medium">
                • <strong className="text-emerald-400 font-bold">Early Collection (Gained +):</strong> When Merchant pays before Mill payment date, cash is retained. Earn 12% p.a. interest!
                <br /><br />
                • <strong className="text-rose-400 font-bold">Delay Financing (Cost -):</strong> When Merchant payment is delayed past mill payment date, financing charge is deducted.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-950/80 rounded-xl border border-emerald-600 text-xs text-emerald-200 font-mono font-bold leading-relaxed">
            <span className="text-white uppercase tracking-wider block mb-1">Final Realized Net Profit Formula:</span>
            (Total Realized Inflows) - (Total COGS) + (Net 12% Float Interest Gain) - (Mill Delay Financing Cost)
          </div>
        </div>
      )}

      {/* VIEW 1: FLEET-WIDE P&L PERFORMANCE TABLE */}
      {viewMode === 'FLEET_SUMMARY' && (
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Fleet Dispatches</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{trucks.length} Trucks</span>
              <span className="text-[11px] font-semibold text-emerald-700 mt-0.5 block">{settledTrucks.length} Settled & Reconciled</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Realized Inflows</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">₹{totalFleetInflows.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">From Wholesale Merchants</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Cost of Goods (COGS)</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">₹{totalFleetCOGS.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">Mill Paid + Levies + Bags + Comm</span>
            </div>

            <div className="bg-linear-to-br from-emerald-800 to-teal-950 text-white p-4 rounded-xl shadow-xs">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">Net Realized Fleet Profit</span>
              <span className="text-2xl font-black text-emerald-300 mt-1 block">₹{totalFleetNetProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span className="text-[11px] font-bold text-emerald-200 mt-0.5 block">Avg ₹{avgFleetProfitPerQtl.toFixed(2)} / Quintal</span>
            </div>
          </div>

          {/* Filter Bar */}
          <FilterBar
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            statusOptions={statusOptions}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            placeholder="Search Serial, Truck No, Miller, PO Contract..."
            onReset={() => { setSearch(''); setStatus('ALL'); setFilterDate(''); }}
            onExportAllPdf={() => exportFleetPdf(filteredTrucks, 'Fleet Consolidated P&L (All Filtered Dispatches)')}
            onExportWeekPdf={() => {
              const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
              const weekTrucks = filteredTrucks.filter((t) => t.date && new Date(t.date) >= sevenDaysAgo);
              exportFleetPdf(weekTrucks.length > 0 ? weekTrucks : filteredTrucks, 'Fleet Consolidated P&L (Last 7 Days)');
            }}
            onExportDatePdf={(targetDate) => {
              const dateTrucks = filteredTrucks.filter((t) => (t.date && t.date.startsWith(targetDate)) || (t.unloading_date && t.unloading_date.startsWith(targetDate)));
              exportFleetPdf(dateTrucks.length > 0 ? dateTrucks : filteredTrucks, `Fleet Consolidated P&L (${targetDate || 'Selected Date'})`);
            }}
          />

          {/* Fleet P&L Table (Matching user screenshot) */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
            {/* Ribbon Bar Above Table */}
            <div className="bg-[#fff9db] border-b border-[#fcd34d] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                <Calendar className="w-4 h-4 text-[#d97706]" />
                <span>Consolidated Fleet Profit & Loss Statement (Per Truck Dispatch)</span>
              </div>
              <span className="bg-[#059669] text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs">
                {filteredTrucks.length} dispatches
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="grid-table w-full text-left text-xs border border-slate-300">
                <thead>
                  <tr className="bg-[#2b6cb0] text-white font-bold tracking-wider text-[11px] uppercase border-b-2 border-blue-900">
                    <th className="py-2.5 px-3 border-r border-blue-400/40">Serial</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40">Truck Number</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40">PO Contract</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40">Miller / Supplier</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bags</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Packing</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Qtls</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Rate</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Mill Outflow (₹)</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-left">Payment Timeline & Gap</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Total COGS (₹)</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Sales Inflow (₹)</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Net Profit (₹)</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Profit / Qtl</th>
                    <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan="16" className="py-12 text-center text-slate-400 border border-slate-300">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          <span>Calculating fleet profit & loss statement...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTrucks.length === 0 ? (
                    <tr>
                      <td colSpan="16" className="py-12 text-center text-slate-400 border border-slate-300">
                        No trucks match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTrucks.map((t, idx) => {
                      const rowBg = idx % 4 < 2 ? 'bg-[#edfdf1] hover:bg-[#dcfce7]' : 'bg-[#f7f2fb] hover:bg-[#ede5f7]';
                      const kgVal = t.kg_per_bag || 30;
                      const hasProfit = t.net_profit !== null && t.net_profit !== undefined;
                      const isProfit = Number(t.net_profit) >= 0;

                      return (
                        <tr key={t.id} className={`${rowBg} transition-colors`}>
                          <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-b border-slate-300 whitespace-nowrap">{t.truck_serial}</td>
                          <td className="py-2.5 px-3 font-bold table-number text-slate-900 border-r border-b border-slate-300 whitespace-nowrap">{t.truck_number}</td>
                          <td className="py-2.5 px-3 border-r border-b border-slate-300 whitespace-nowrap">
                            {t.linked_contract_no ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {t.linked_contract_no}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Direct</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[170px] truncate border-r border-b border-slate-300" title={t.seller_name}>
                            {t.seller_name}
                          </td>
                          <td className="py-2.5 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300">{Number(t.bags).toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-b border-slate-300">
                            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-extrabold border border-amber-300">
                              {kgVal} KG
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300">{Number(t.qty_qtls).toFixed(1)}</td>
                          <td className="py-2.5 px-3 text-right table-number font-medium border-r border-b border-slate-300">₹{Number(t.rate_per_qtl).toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-right table-number font-semibold text-slate-800 border-r border-b border-slate-300">
                            ₹{Number(t.purchase_payment_amount || Number(t.purchase_amount) * 0.98).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2.5 px-3 text-left border-r border-b border-slate-300 whitespace-nowrap">
                            <div>
                              <div className="text-[11px] font-semibold text-slate-800 flex items-center space-x-1">
                                <span className="text-slate-400">Mill:</span>
                                <span className="font-bold text-slate-900">
                                  {t.purchase_payment_date ? new Date(t.purchase_payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Pending'}
                                </span>
                              </div>
                              <div className="text-[11px] font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
                                <span className="text-slate-400">Sale:</span>
                                <span className="font-bold text-blue-900">
                                  {t.sale_amount_received_date ? new Date(t.sale_amount_received_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Pending'}
                                </span>
                              </div>
                              {Number(t.purchase_gap_days) !== 0 && t.purchase_gap_days !== null && t.purchase_gap_days !== undefined && (
                                <span className={`text-[10px] font-bold block mt-0.5 ${Number(t.purchase_gap_days) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {Number(t.purchase_gap_days) > 0 ? `Gap: +${t.purchase_gap_days}d delay` : `Float: ${Math.abs(Number(t.purchase_gap_days))}d gain`}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right table-number font-extrabold text-slate-900 border-r border-b border-slate-300">
                            ₹{Number(t.cost_of_goods).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2.5 px-3 text-right table-number font-extrabold text-blue-900 border-r border-b border-slate-300">
                            ₹{Number(t.effective_inflow).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2.5 px-3 text-right table-number border-r border-b border-slate-300 whitespace-nowrap">
                            {hasProfit ? (
                              <span className={`px-2.5 py-0.5 rounded-md font-black text-[11px] inline-block ${
                                isProfit
                                  ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]'
                                  : 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                              }`}>
                                {isProfit ? `+₹${Number(t.net_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `-₹${Math.abs(Number(t.net_profit)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 italic">Pending Sales</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right table-number border-r border-b border-slate-300 whitespace-nowrap">
                            {hasProfit ? (
                              <span className={`font-black text-[11px] ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {isProfit ? `+₹${Number(t.profit_per_qtl).toFixed(1)}` : `-₹${Math.abs(Number(t.profit_per_qtl)).toFixed(1)}`}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-b border-slate-300">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center leading-tight ${
                              t.status === 'SETTLED' ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]' :
                              t.status === 'UNLOADED' ? 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]' : 'bg-[#e0f2fe] text-[#0369a1] border border-[#7dd3fc]'
                            }`}>
                              {t.status === 'SETTLED' ? 'SETTLED ✓' : t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap border-b border-slate-300">
                            <button
                              onClick={() => loadSettlement(t.id, true)}
                              className="px-2.5 py-1 rounded bg-white hover:bg-blue-50 text-[#2b6cb0] font-bold text-xs border border-slate-300 shadow-2xs inline-flex items-center space-x-1 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#2b6cb0]" />
                              <span>Invoice Receipt ↗</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-black text-slate-900">
                    <td colSpan="4" className="py-2.5 px-3 uppercase text-[11px] tracking-wider">TOTAL (current page)</td>
                    <td className="py-2.5 px-3 text-right table-number">{filteredTrucks.reduce((a, t) => a + (Number(t.bags) || 0), 0).toLocaleString('en-IN')}</td>
                    <td />
                    <td className="py-2.5 px-3 text-right table-number">{filteredTrucks.reduce((a, t) => a + (Number(t.qty_qtls) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td />
                    <td className="py-2.5 px-3 text-right table-number">₹{filteredTrucks.reduce((a, t) => a + Number(t.purchase_payment_amount || Number(t.purchase_amount) * 0.98), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td />
                    <td className="py-2.5 px-3 text-right table-number">₹{filteredTrucks.reduce((a, t) => a + (Number(t.cost_of_goods) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2.5 px-3 text-right table-number">₹{filteredTrucks.reduce((a, t) => a + (Number(t.effective_inflow) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="py-2.5 px-3 text-right table-number">₹{filteredTrucks.reduce((a, t) => a + (Number(t.net_profit) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td /><td /><td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SINGLE TRUCK DEEP ACCOUNTING AUDIT LEDGER */}
      {viewMode === 'TRUCK_AUDIT' && (
        <div className="space-y-6">
          {/* Active Truck Header & Switcher */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setViewMode('FLEET_SUMMARY')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                title="Back to Fleet Table"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    {truck?.truck_serial} ({truck?.truck_number})
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                    {truck?.brand} Packaging ({truck?.kg_per_bag || 30} KG)
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mt-0.5">
                  <span>Miller: <strong>{truck?.seller_name}</strong></span>
                  <span>•</span>
                  <span>PO: <strong>{truck?.linked_contract_no || 'Direct'}</strong></span>
                  <span>•</span>
                  <span>Total Qty: <strong>{truck?.qty_qtls} Qtls ({truck?.bags} Bags)</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Switch Truck:</label>
              <select
                value={selectedTruck?.id || ''}
                onChange={(e) => loadSettlement(Number(e.target.value), true)}
                className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {(Array.isArray(trucks) ? trucks : []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.truck_serial} ({t.truck_number}) - {t.seller_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 1: Mill Payment Settlement Form (The Anchor Outflow) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Mill Procurement Settlement (The Anchor Outflow for 12% Float Engine)</span>
              </h2>
              <button
                type="button"
                onClick={handleAutoFill2PercentCD}
                className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg cursor-pointer"
              >
                ⚡ Auto-fill 2% Cash Discount (₹{Number(truck?.purchase_amount * 0.98).toLocaleString('en-IN', { maximumFractionDigits: 2 })})
              </button>
            </div>

            <form onSubmit={handleUpdatePayment} className="space-y-3 text-xs font-medium">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Base Invoice Value</label>
                  <div className="py-2 px-3 bg-slate-100 rounded-lg font-bold table-number text-slate-800 border border-slate-200">
                    ₹{Number(truck?.purchase_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Actual Paid to Mill (-2% CD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePaymentAmount}
                    onChange={(e) => setPurchasePaymentAmount(e.target.value)}
                    placeholder="e.g. 1797833.52"
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold table-number text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Purchase Payment Date</label>
                  <input
                    type="date"
                    value={purchasePaymentDate}
                    onChange={(e) => setPurchasePaymentDate(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Final Wholesale Sale Collection Date</label>
                  <input
                    type="date"
                    value={saleAmountReceivedDate}
                    onChange={(e) => setSaleAmountReceivedDate(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mill Payment Mode</label>
                  <select
                    value={purchasePaymentMode}
                    onChange={(e) => setPurchasePaymentMode(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="RTGS/NEFT">RTGS / NEFT</option>
                    <option value="Bank Transfer">Bank Transfer / IMPS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mill UTR / Cheque Ref No</label>
                  <input
                    type="text"
                    value={purchasePaymentRef}
                    onChange={(e) => setPurchasePaymentRef(e.target.value)}
                    placeholder="e.g. UTR-20261015-8491"
                    className="w-full py-2 px-3 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs cursor-pointer transition-colors text-center"
                  >
                    Save Mill Settlement & Realize P&L
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 2: CLEAN, PROFESSIONAL TRUCK SETTLEMENT INVOICE RECEIPT (P&L PATTI) */}
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-lg overflow-hidden">
            {/* Receipt Header Banner */}
            <div className="bg-[#1e293b] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-amber-500">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5 text-amber-400" />
                  <span className="text-lg sm:text-xl font-black uppercase tracking-wider text-amber-300">
                    Truck Settlement Invoice Receipt (P&L Patti)
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Official settlement voucher: rice consignment, buyer deliveries, cost deductions, and net profit
                </p>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={() => exportTruckSettlementReceiptPdf({ truck, sales, metrics })}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-md inline-flex items-center space-x-1.5 cursor-pointer transition-all"
                  title="Download clean PDF file with tables directly to your computer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-md inline-flex items-center space-x-1.5 cursor-pointer transition-all"
                  title="Print receipt or save as PDF via system print dialog"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                  truck?.status === 'SETTLED' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
                }`}>
                  {truck?.status === 'SETTLED' ? 'SETTLED ✓' : 'UNLOADED / PENDING'}
                </span>
              </div>
            </div>

            {/* Invoice Receipt Body */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* 1. Header Details Box (Inward Truck & Contract Details) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Truck Registration</span>
                  <strong className="text-sm font-black text-slate-900">{truck?.truck_serial} • {truck?.truck_number}</strong>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[11px] text-slate-600 font-semibold">LF: ₹{Number(truck?.truck_lf || 0)}/Q</span>
                    {Number(truck?.lorry_advance || 0) > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                        Adv: ₹{Number(truck.lorry_advance).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Rice Mill (Seller)</span>
                  <strong className="text-sm font-black text-slate-900">{truck?.seller_name}</strong>
                  <span className="block text-[11px] text-slate-500 mt-0.5">PO: {truck?.linked_contract_no || 'Direct'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Inward Quantity & Packaging</span>
                  <strong className="text-sm font-black text-slate-900">{Number(truck?.qty_qtls || 0).toFixed(1)} Qtls ({Number(truck?.bags || 0).toLocaleString('en-IN')} Bags)</strong>
                  <span className="block text-[11px] text-blue-700 font-bold mt-0.5">Rate: ₹{Number(truck?.rate_per_qtl || 0).toLocaleString('en-IN')}/Qtl</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Arrival & Unloading Date</span>
                  <strong className="text-sm font-black text-slate-900">
                    {truck?.unloading_date ? new Date(truck.unloading_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (truck?.date ? new Date(truck.date).toLocaleDateString('en-IN') : '-')}
                  </strong>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Bill: {truck?.purchase_bill_no || '-'}</span>
                </div>
              </div>

              {/* 2. Deliveries Table (Wholesale Sales to Parties) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center space-x-1.5">
                    <span>📦 Deliveries & Sales Breakdown (Wholesale Merchants)</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">{sales.length} Bills Dispatched</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-300">
                  <table className="w-full text-left text-xs grid-table">
                    <thead>
                      <tr className="bg-[#2b6cb0] text-white font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 border-r border-blue-400/40">Inv #</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40">Buyer Party Name</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bags</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Qty (Q)</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bill Rate</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">LF Ded</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bill Amount</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Received</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Discount</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Cutting</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Payment Date</th>
                        <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Days vs Mill</th>
                        <th className="py-2.5 px-3 text-right">Interest Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sales.length === 0 ? (
                        <tr>
                          <td colSpan="13" className="py-8 text-center text-slate-400 italic">
                            No sales bills allocated to this truck yet.
                          </td>
                        </tr>
                      ) : (
                        sales.map((s, idx) => {
                          const isEarned = Number(s.interest_days) < 0;
                          const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                          return (
                            <tr key={s.id} className={rowBg}>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-slate-300">{s.sale_bill_no}</td>
                              <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300">{s.party_name}</td>
                              <td className="py-2 px-3 text-right font-bold table-number border-r border-slate-300">{Number(s.bags).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right table-number border-r border-slate-300">{Number(s.qty_qtls).toFixed(1)}</td>
                              <td className="py-2 px-3 text-right table-number border-r border-slate-300">₹{Number(s.billing_rate).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right table-number text-rose-700 border-r border-slate-300">₹{Number(s.lorry_amount || 0).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right table-number font-bold text-slate-900 border-r border-slate-300">₹{Number(s.bill_amount).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right table-number font-bold text-emerald-800 border-r border-slate-300">₹{Number(s.received_amount || 0).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right table-number text-slate-600 border-r border-slate-300">₹{Number(s.discount_amount || 0).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-right table-number text-slate-600 border-r border-slate-300">₹{Number(s.cutting_amount || 0).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-300">
                                {s.sale_received_date ? new Date(s.sale_received_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                              </td>
                              <td className="py-2 px-3 text-center table-number font-bold border-r border-slate-300">
                                {s.interest_days !== undefined ? (
                                  <span className={isEarned ? 'text-emerald-700' : Number(s.interest_days) > 0 ? 'text-rose-700' : 'text-slate-500'}>
                                    {s.interest_days > 0 ? `+${s.interest_days}d` : `${s.interest_days}d`}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="py-2 px-3 text-right table-number font-bold">
                                {Number(s.interest_amount) !== 0 ? (
                                  <span className={isEarned ? 'text-emerald-700' : 'text-rose-700'}>
                                    {isEarned ? `+₹${Math.abs(Number(s.interest_amount)).toFixed(0)}` : `-₹${Math.abs(Number(s.interest_amount)).toFixed(0)}`}
                                  </span>
                                ) : '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {/* Deliveries Subtotals Row */}
                    {sales.length > 0 && (
                      <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                        <tr>
                          <td colSpan="2" className="py-2 px-3 uppercase text-right border-r border-slate-300">Deliveries Total:</td>
                          <td className="py-2 px-3 text-right table-number border-r border-slate-300">{Number(metrics.totalBagsSold || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right table-number border-r border-slate-300">{Number(metrics.totalQtlsSold || 0).toFixed(1)}</td>
                          <td className="py-2 px-3 border-r border-slate-300"></td>
                          <td className="py-2 px-3 text-right table-number text-rose-800 border-r border-slate-300">₹{Number(metrics.totalLorryDeduction || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right table-number border-r border-slate-300">₹{Number(metrics.totalBillAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right table-number text-emerald-900 border-r border-slate-300">₹{Number(metrics.totalReceivedAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right table-number text-slate-700 border-r border-slate-300">₹{Number(metrics.totalDiscount || 0).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 text-right table-number text-slate-700 border-r border-slate-300">₹{Number(metrics.totalCutting || 0).toLocaleString('en-IN')}</td>
                          <td colSpan="2" className="border-r border-slate-300"></td>
                          <td className="py-2 px-3 text-right table-number text-emerald-700">
                            {Number(metrics.totalInterestEarned || 0) > 0 ? `+₹${Number(metrics.totalInterestEarned).toFixed(0)}` : '-'}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* 3. The Clean Invoice Receipt Summary (Clear Step-by-Step Breakdown) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* LEFT: Inward Bill (Purchase, LF & Costs) */}
                <div className="bg-amber-50/70 rounded-xl border border-amber-300 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div>
                      <span className="font-black text-xs text-amber-950 uppercase tracking-wide block">
                        ⬅️ INWARD BILL (PURCHASE & DIRECT COSTS)
                      </span>
                      <span className="text-[10px] text-amber-800 font-semibold">
                        Mill Inward Bill (-2% CD) + Lorry Freight + APMC + TCS + Bags + Brokerage
                      </span>
                    </div>
                    <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded uppercase">
                      Inward Costs
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {/* Inward Bill Number & Mill Identification */}
                    <div className="bg-amber-100/80 p-2 rounded-lg border border-amber-300 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-amber-900 font-extrabold uppercase block tracking-wider">Inward Mill Bill / Invoice No:</span>
                        <span className="font-mono font-black text-sm text-blue-950">{truck?.purchase_bill_no || 'Direct / Under Settle'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-amber-900 font-extrabold uppercase block tracking-wider">Rice Mill (Seller):</span>
                        <span className="font-bold text-xs text-slate-900">{truck?.seller_name || '-'}</span>
                      </div>
                    </div>

                    {/* Mill Purchase Calculation (Rice Cost) */}
                    <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-blue-900 uppercase">1. Rice Purchase (Mill Outflow):</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{truck?.qty_qtls} Q @ ₹{truck?.rate_per_qtl}/Q</span>
                      </div>
                      <div className="flex justify-between text-slate-700 text-[11px]">
                        <span>• Mill Purchase Gross:</span>
                        <span className="font-bold table-number text-slate-800">₹{Number(truck?.purchase_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-semibold text-[11px]">
                        <span>• Less: 2% Cash Discount (CD Benefit):</span>
                        <span className="font-bold table-number">-₹{Number(Number(truck?.purchase_amount || 0) * 0.02).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-amber-100 font-black text-slate-900">
                        <span>Net Paid to Mill:</span>
                        <span className="text-emerald-900 table-number">₹{Number(metrics.purchasePaid || Number(truck?.purchase_amount || 0) * 0.98).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Explicit Lorry Expenses Section (LF and LF Advance) */}
                    <div className="bg-amber-100/80 p-2.5 rounded-lg border border-amber-300 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-amber-950 uppercase flex items-center space-x-1">
                          <span>🚚 LORRY EXPENSES (LF & LF ADVANCE):</span>
                        </span>
                        <span className="text-[10px] font-bold text-amber-800">
                          LF Rate: ₹{Number(truck?.truck_lf || 0)}/Q
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-800 text-[11px]">
                        <span>• Total Lorry Freight (LF) ({truck?.qty_qtls} Q × ₹{truck?.truck_lf}/Q):</span>
                        <span className="font-bold table-number text-slate-900">
                          ₹{Number(Number(truck?.qty_qtls || 0) * Number(truck?.truck_lf || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-900 font-bold text-[11px]">
                        <span>• Lorry Advance Paid to Driver:</span>
                        <span className="table-number">
                          ₹{Number(truck?.lorry_advance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-900 text-[11px] pt-0.5 border-t border-amber-200 font-semibold">
                        <span>• Lorry Freight Balance to Settle:</span>
                        <span className="table-number">
                          ₹{Number((Number(truck?.qty_qtls || 0) * Number(truck?.truck_lf || 0)) - Number(truck?.lorry_advance || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Levies & Operating Costs */}
                    <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2. Mandatory Levies & Handling Charges:</span>
                      
                      <div className="flex justify-between text-slate-700">
                        <span>• APMC Mandi Tax (0.6% on Billed ₹{Number(metrics.totalBillAmount || 0).toLocaleString('en-IN')}):</span>
                        <span className="font-bold table-number text-slate-900">₹{Number(metrics.apmcCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>• IT TDS / TCS (0.39% on Billed):</span>
                        <span className="font-bold table-number text-slate-900">₹{Number(metrics.itCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>• Empty Bags / EGB ({truck?.qty_qtls} Q @ ₹100/Q):</span>
                        <span className="font-bold table-number text-slate-900">₹{Number(metrics.egbCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>• Bags Freight / Trpt ({truck?.qty_qtls} Q @ ₹20/Q):</span>
                        <span className="font-bold table-number text-slate-900">₹{Number(metrics.egbTrptCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>• Selling Brokerage:</span>
                        <span className="font-bold table-number text-slate-900">₹{Number(metrics.effectiveBrokerageCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      {Number(metrics.purchaseDelayInterest || 0) > 0 && (
                        <div className="flex justify-between text-rose-700 font-bold">
                          <span>• Delay Financing Interest ({truck?.purchase_gap_days || 0} days):</span>
                          <span className="table-number">+₹{Number(metrics.purchaseDelayInterest || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total Expenses Grand Summary */}
                  <div className="flex justify-between p-2.5 bg-amber-200/70 rounded-xl border border-amber-400 font-black text-xs text-amber-950">
                    <span className="uppercase">TOTAL OUTFLOWS (PURCHASE + LEVIES):</span>
                    <span className="table-number text-rose-900 text-sm">₹{Number(metrics.costOfGoods || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* RIGHT: Selling Bill (Cash Inflows, Deductions & Final Profit) */}
                <div className="bg-emerald-50/70 rounded-xl border border-emerald-300 p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <div>
                        <span className="font-black text-xs text-emerald-950 uppercase tracking-wide block">
                          ➡️ SELLING BILL (BUYER REALIZATION & COLLECTIONS)
                        </span>
                        <span className="text-[10px] text-emerald-800 font-semibold">
                          Gross Selling Bill minus Discounts & Cutting = Net Bank Inflow
                        </span>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded uppercase">
                        Selling Money
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs mt-2">
                      <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 space-y-2">
                        <div className="flex justify-between font-black text-slate-900 text-sm border-b border-emerald-100 pb-1">
                          <span>Gross Deliveries Billed:</span>
                          <span className="table-number text-emerald-950">₹{Number(metrics.totalBillAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>

                        {/* Split of Sales Bills (Detailed Breakdown of the Gross Billed Amount) */}
                        {sales && sales.length > 0 && (
                          <div className="bg-emerald-50/70 p-2 rounded-md border border-emerald-200 space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-black text-emerald-900 uppercase tracking-wider pb-0.5 border-b border-emerald-200">
                              <span>Wholesale Deliveries Split ({sales.length} Bills):</span>
                              <span>Billed Amount</span>
                            </div>
                            {sales.map((s, idx) => (
                              <div key={s.id || idx} className="flex justify-between items-center text-[11px] text-slate-800 border-b border-emerald-100/70 last:border-0 py-0.5">
                                <div className="flex items-center space-x-1.5 truncate pr-2">
                                  <span className="font-mono font-black text-blue-900 bg-blue-50 px-1 py-0.2 rounded border border-blue-200 shrink-0">
                                    Bill #{s.sale_bill_no}
                                  </span>
                                  <span className="font-bold text-slate-900">{s.party_name}</span>
                                  <span className="text-[10px] text-slate-500">
                                    ({Number(s.bags)} Bags • {Number(s.qty_qtls).toFixed(1)} Q @ ₹{Number(s.billing_rate).toLocaleString('en-IN')}/Q)
                                  </span>
                                </div>
                                <span className="font-black table-number text-slate-900 shrink-0">
                                  ₹{Number(s.bill_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Deductions from Gross Billed */}
                        <div className="space-y-1 pt-0.5">
                          <div className="flex justify-between text-rose-700 text-[11px] font-semibold">
                            <span>- Less: Cash Discount (CD Allowed):</span>
                            <span className="table-number">-₹{Number(metrics.totalDiscount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-rose-700 text-[11px] font-semibold">
                            <span>- Less: Weight / Quality Shortage Cutting:</span>
                            <span className="table-number">-₹{Number(metrics.totalCutting || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                          {Number(metrics.totalLorryDeduction || 0) > 0 && (
                            <div className="flex justify-between text-rose-700 text-[11px] font-semibold">
                              <span>- Less: Lorry Freight (LF) Deduction:</span>
                              <span className="table-number">-₹{Number(metrics.totalLorryDeduction || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-emerald-200 font-black text-slate-900 text-xs">
                            <span>(B) Actual Cash Received in Bank:</span>
                            <span className="text-emerald-950 font-black table-number text-sm">₹{Number(metrics.totalReceivedAmount || metrics.totalBillAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-200 space-y-1 text-slate-700 font-medium">
                        {Number(metrics.totalInterestEarned || 0) > 0 && (
                          <div className="flex justify-between text-emerald-800 font-bold">
                            <span>+ Early Collection Interest Gained (12% p.a.):</span>
                            <span className="table-number">+₹{Number(metrics.totalInterestEarned || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-rose-800 font-bold">
                          <span>- Less: Inward Bill Total Costs (from Left Side):</span>
                          <span className="table-number">-₹{Number(metrics.costOfGoods || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: Final Net Profit Card */}
                  <div className={`p-4 rounded-xl border-2 shadow-sm mt-3 ${
                    Number(metrics.netProfit) >= 0 
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 border-emerald-800 text-white' 
                      : 'bg-gradient-to-r from-rose-600 to-rose-700 border-rose-800 text-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-100 block">
                          STEP 3: NET PROFIT = (BANK CASH RECEIVED - GOODS COST)
                        </span>
                        <span className="text-2xl font-black table-number">
                          {Number(metrics.netProfit) >= 0 ? `+₹${Number(metrics.netProfit).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : `-₹${Math.abs(Number(metrics.netProfit)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-100 block">
                          NET PER QUINTAL
                        </span>
                        <span className="text-xl font-black table-number">
                          {Number(metrics.netProfit) >= 0 ? `+₹${(Number(metrics.netProfit) / Number(truck?.qty_qtls || 1)).toFixed(2)}` : `-₹${Math.abs(Number(metrics.netProfit) / Number(truck?.qty_qtls || 1)).toFixed(2)}`}/Q
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

