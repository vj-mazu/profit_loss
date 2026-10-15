import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Factory, 
  FileText, 
  Edit, 
  Trash2, 
  Search, 
  CheckCircle, 
  Calculator, 
  Calendar,
  Truck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../services/api';
import Modal from './Modal';
import FilterBar from './FilterBar';
import { useAuth } from '../context/AuthContext';

export default function OrdersTab() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [egbStock, setEgbStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEgbLedger, setShowEgbLedger] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);

  // Bag Colors Master State
  const [bagColors, setBagColors] = useState([
    { id: 'blue', name: 'Blue', color_code: '#2563eb' },
    { id: 'orange', name: 'Orange', color_code: '#ea580c' },
    { id: 'green', name: 'Green', color_code: '#16a34a' },
    { id: 'red', name: 'Red', color_code: '#dc2626' },
    { id: 'yellow', name: 'Yellow', color_code: '#ca8a04' },
    { id: 'white', name: 'White', color_code: '#64748b' },
  ]);
  const [isAddingCustomColor, setIsAddingCustomColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#2563eb');

  // EGB manual stock adjust modal state
  const [adjustEgb, setAdjustEgb] = useState(null); // egb row object
  const [egbForm, setEgbForm] = useState({ blue_bags: '', orange_bags: '', green_bags: '', total_bags: '', tons: '', no_of_bundles: '', rc_tempo_bus: '', lf_per_qtl: '' });

  // Clean form state supporting any KG/bag and dynamic empty bags supplied
  const [formData, setFormData] = useState({
    contract_no: '',
    seller_name: '',
    seller_address: '',
    gst_no: '',
    contract_date: new Date().toISOString().split('T')[0],
    kg_per_bag: 30,
    bags: '',
    qty_qtls: '',
    rate_per_qtl: '',
    egb_rate_per_qtl: 100,
    buying_brokerage_per_qtl: '',
    broker_name: '',
    bags_given: '',
    bags_given_blue: '',
    bags_given_orange: '',
    bags_given_green: '',
    bag_transport_cost: '',
    brand_colors: {},
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, mastersRes] = await Promise.all([
        api.getOrders(),
        api.getMasters().catch(() => ({ data: {} })),
      ]);
      setOrders(ordersRes.data.orders || []);
      setEgbStock(ordersRes.data.egb_stock || []);
      if (mastersRes.data?.bag_colors?.length > 0) {
        setBagColors(mastersRes.data.bag_colors);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddInlineColor = async (e) => {
    e?.preventDefault();
    if (!newColorName.trim()) return;
    const clean = newColorName.trim();
    if (bagColors.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      alert(`Color "${clean}" is already added.`);
      return;
    }
    const newEntry = {
      id: clean.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: clean,
      color_code: newColorHex || '#2563eb',
    };
    const updated = [...bagColors, newEntry];
    setBagColors(updated);
    setNewColorName('');
    setIsAddingCustomColor(false);
    try {
      await api.updateBagColors(updated);
    } catch (err) {
      console.error('Failed to save color to masters', err);
    }
  };

  const handleOpenCreateModal = async () => {
    setEditingOrderId(null);
    let autoPo = 'PO-01';
    try {
      const res = await api.getNextContractNo();
      if (res.data?.next_contract_no) {
        autoPo = res.data.next_contract_no;
      }
    } catch {
      if (orders && orders.length > 0) {
        let maxNum = 0;
        orders.forEach((o) => {
          if (o.contract_no) {
            const match = o.contract_no.trim().match(/^PO-0*(\d+)$/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          }
        });
        autoPo = `PO-${String(maxNum + 1).padStart(2, '0')}`;
      }
    }

    const initColors = {};
    bagColors.forEach((c) => {
      initColors[c.name] = '';
    });

    setFormData({
      contract_no: autoPo,
      seller_name: '',
      seller_address: '',
      gst_no: '',
      contract_date: new Date().toISOString().split('T')[0],
      kg_per_bag: 30,
      bags: '',
      qty_qtls: '',
      rate_per_qtl: '',
      egb_rate_per_qtl: 100,
      buying_brokerage_per_qtl: '',
      broker_name: '',
      bags_given: '',
      bags_given_blue: '',
      bags_given_orange: '',
      bags_given_green: '',
      bag_transport_cost: '',
      brand_colors: initColors,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (order) => {
    setEditingOrderId(order.id);
    const initColors = {};
    bagColors.forEach((c) => {
      initColors[c.name] = '';
    });
    if (order.brand_colors && typeof order.brand_colors === 'object') {
      Object.entries(order.brand_colors).forEach(([k, v]) => {
        initColors[k] = v || '';
      });
    }
    // Also merge legacy fields if populated
    if (order.bags_given_blue && !initColors['Blue']) initColors['Blue'] = order.bags_given_blue;
    if (order.bags_given_orange && !initColors['Orange']) initColors['Orange'] = order.bags_given_orange;
    if (order.bags_given_green && !initColors['Green']) initColors['Green'] = order.bags_given_green;

    // And any colors from order.color_breakdown
    if (order.color_breakdown && typeof order.color_breakdown === 'object') {
      Object.entries(order.color_breakdown).forEach(([k, d]) => {
        if (d.sent > 0 && !initColors[k]) initColors[k] = d.sent;
      });
    }

    setFormData({
      contract_no: order.contract_no || '',
      seller_name: order.seller_name || '',
      seller_address: order.seller_address || '',
      gst_no: order.gst_no || '',
      contract_date: order.contract_date ? new Date(order.contract_date).toISOString().split('T')[0] : '',
      kg_per_bag: order.kg_per_bag || 30,
      bags: order.qty_qtls ? Math.round((Number(order.qty_qtls) * 100) / (Number(order.kg_per_bag) || 30)) : '',
      qty_qtls: order.qty_qtls || '',
      rate_per_qtl: order.rate_per_qtl || '',
      egb_rate_per_qtl: order.egb_rate_per_qtl !== undefined && order.egb_rate_per_qtl !== null ? order.egb_rate_per_qtl : 100,
      buying_brokerage_per_qtl: order.buying_brokerage_per_qtl !== undefined && order.buying_brokerage_per_qtl !== null ? order.buying_brokerage_per_qtl : '',
      broker_name: order.broker_name || '',
      bags_given: order.bags_given || '',
      bags_given_blue: order.bags_given_blue || '',
      bags_given_orange: order.bags_given_orange || '',
      bags_given_green: order.bags_given_green || '',
      bag_transport_cost: order.bag_transport_cost || '',
      brand_colors: initColors,
    });
    setIsModalOpen(true);
  };

  const handleBagsChange = (bagsVal, kgVal = formData.kg_per_bag) => {
    const b = Number(bagsVal) || 0;
    const k = Number(kgVal) || 30;
    const computed = b > 0 ? Math.round((b * k / 100) * 100) / 100 : '';
    setFormData((prev) => ({
      ...prev,
      bags: bagsVal,
      kg_per_bag: k,
      qty_qtls: computed !== '' ? computed : prev.qty_qtls,
    }));
  };

  const handleKgPerBagChange = (kgVal) => {
    // 'custom' just switches the form to custom-KG mode; a real number recomputes Qty.
    if (kgVal === 'custom') {
      setFormData((prev) => ({ ...prev, kg_per_bag: 'custom' }));
      return;
    }
    const k = Number(kgVal) || 30;
    const b = Number(formData.bags) || 0;
    const computed = b > 0 ? Math.round((b * k / 100) * 100) / 100 : formData.qty_qtls;
    setFormData((prev) => ({
      ...prev,
      kg_per_bag: k,
      qty_qtls: computed !== '' ? computed : prev.qty_qtls,
    }));
  };

  const handleDynamicBagColorChange = (colorName, val) => {
    setFormData((prev) => {
      const updatedColors = { ...(prev.brand_colors || {}), [colorName]: val };
      let totalBags = 0;
      Object.values(updatedColors).forEach((v) => {
        totalBags += Number(v) || 0;
      });
      return {
        ...prev,
        brand_colors: updatedColors,
        bags_given: totalBags > 0 ? totalBags : '',
        bags_given_blue: updatedColors['Blue'] !== undefined ? updatedColors['Blue'] : prev.bags_given_blue,
        bags_given_orange: updatedColors['Orange'] !== undefined ? updatedColors['Orange'] : prev.bags_given_orange,
        bags_given_green: updatedColors['Green'] !== undefined ? updatedColors['Green'] : prev.bags_given_green,
      };
    });
  };

  const handleEmptyBagsChange = (field, val) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: val };
      const blue = Number(updated.bags_given_blue) || 0;
      const orange = Number(updated.bags_given_orange) || 0;
      const green = Number(updated.bags_given_green) || 0;
      const sum = blue + orange + green;
      return {
        ...updated,
        bags_given: sum > 0 ? sum : updated.bags_given,
      };
    });
  };

  // ---- Empty Bag Ledger helpers (Excel 'Overall Data' stock-in-hand logic) ----
  const handleOpenAdjustEgb = (e) => {
    setAdjustEgb(e);
    setEgbForm({
      blue_bags: e.blue_bags ?? '',
      orange_bags: e.orange_bags ?? '',
      green_bags: e.green_bags ?? '',
      total_bags: e.total_bags ?? '',
      tons: e.tons ?? '',
      no_of_bundles: e.no_of_bundles ?? '',
      rc_tempo_bus: e.rc_tempo_bus ?? '',
      lf_per_qtl: e.lf_per_qtl ?? '',
    });
  };

  const handleSaveEgbAdjust = async () => {
    try {
      const payload = {};
      for (const k of Object.keys(egbForm)) payload[k] = egbForm[k] === '' || egbForm[k] === null ? null : Number(egbForm[k]);
      if (payload.total_bags === null) payload.total_bags = (Number(payload.blue_bags) || 0) + (Number(payload.orange_bags) || 0) + (Number(payload.green_bags) || 0);
      await api.updateEgbStock(adjustEgb.id, payload);
      setAdjustEgb(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update EGB stock');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Calculate total bags given from brand_colors
      let dynamicTotal = 0;
      if (formData.brand_colors && typeof formData.brand_colors === 'object') {
        Object.values(formData.brand_colors).forEach((v) => {
          dynamicTotal += Number(v) || 0;
        });
      }
      if (dynamicTotal === 0) {
        dynamicTotal = Number(formData.bags_given) || 0;
      }

      const payload = {
        ...formData,
        kg_per_bag: Number(formData.kg_per_bag) || 30,
        qty_qtls: Number(formData.qty_qtls) || ((Number(formData.bags) * Number(formData.kg_per_bag)) / 100),
        rate_per_qtl: Number(formData.rate_per_qtl) || 0,
        brand_colors: formData.brand_colors || {},
        bags_given: dynamicTotal,
        bags_given_blue: Number(formData.brand_colors?.['Blue'] || formData.bags_given_blue) || 0,
        bags_given_orange: Number(formData.brand_colors?.['Orange'] || formData.bags_given_orange) || 0,
        bags_given_green: Number(formData.brand_colors?.['Green'] || formData.bags_given_green) || 0,
        bag_transport_cost: Number(formData.bag_transport_cost) || 0,
        egb_rate_per_qtl: formData.egb_rate_per_qtl !== '' ? Number(formData.egb_rate_per_qtl) : 100,
        buying_brokerage_per_qtl: Number(formData.buying_brokerage_per_qtl) || 0,
        broker_name: formData.broker_name?.trim() || '',
      };

      if (editingOrderId) {
        await api.updateOrder(editingOrderId, payload);
      } else {
        await api.createOrder(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || (editingOrderId ? 'Failed to update purchase order' : 'Failed to create purchase order'));
    }
  };

  const handleDelete = async (order) => {
    if (window.confirm(`Are you sure you want to delete purchase contract ${order.contract_no}?`)) {
      try {
        await api.deleteOrder(order.id);
        loadData();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete purchase order');
      }
    }
  };

  // Filter orders by search & date presets
  const filteredOrders = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (o.contract_no && o.contract_no.toLowerCase().includes(q)) ||
      (o.seller_name && o.seller_name.toLowerCase().includes(q)) ||
      (o.gst_no && o.gst_no.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (startDate && o.contract_date) {
      const oDate = new Date(o.contract_date).toISOString().split('T')[0];
      if (oDate < startDate) return false;
    }
    if (endDate && o.contract_date) {
      const oDate = new Date(o.contract_date).toISOString().split('T')[0];
      if (oDate > endDate) return false;
    }
    if (month && month !== 'ALL' && o.contract_date) {
      const m = String(new Date(o.contract_date).getMonth() + 1).padStart(2, '0');
      if (m !== month) return false;
    }

    return true;
  });

  const calcQty = Number(formData.qty_qtls) || 0;
  const calcRate = Number(formData.rate_per_qtl) || 0;
  const calcContractValue = calcQty * calcRate;

  // Dynamically calculate empty gunny bag aggregates across all orders
  const colorStatsMap = {};
  filteredOrders.forEach((o) => {
    const cb = o.color_breakdown || {};
    Object.entries(cb).forEach(([col, d]) => {
      const colNorm = col.trim();
      if (!colorStatsMap[colNorm]) {
        colorStatsMap[colNorm] = { name: colNorm, sent: 0, used: 0, remaining: 0 };
      }
      colorStatsMap[colNorm].sent += Number(d.sent) || 0;
      colorStatsMap[colNorm].used += Number(d.used) || 0;
      colorStatsMap[colNorm].remaining += Number(d.remaining) || 0;
    });
  });
  const dynamicColorStats = Object.values(colorStatsMap).filter((c) => c.sent > 0 || c.used > 0);
  const totalEgbAllocated = filteredOrders.reduce((a, o) => a + (Number(o.bags_given) || 0), 0);
  const totalEgbLifted = filteredOrders.reduce((a, o) => a + (Number(o.lifted_bags) || 0), 0);
  const totalEgbRemaining = filteredOrders.reduce((a, o) => a + Math.max(0, Number(o.remaining_bags) || 0), 0);
  const overallLiftPct = totalEgbAllocated > 0 ? Math.round((totalEgbLifted / totalEgbAllocated) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Section Header with Stats & New Order Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-md p-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Purchase Contracts & Rice Mills · Empty Gunny Bags</h1>
          </div>
          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500 mt-1">
            <span className="text-slate-600 font-medium">Procurement Agreements & Empty Bag Allocation</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">{orders.length} Contracts Active</span>
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Purchase Order</span>
        </button>
      </div>

      {/* Filter Bar with Daily, Weekly, Monthly presets */}
      <FilterBar
        search={search}
        setSearch={setSearch}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        month={month}
        setMonth={setMonth}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        placeholder="Search contract number, miller name, or GSTIN..."
        onReset={() => {
          setSearch('');
          setStartDate('');
          setEndDate('');
          setMonth('ALL');
          setFilterDate('');
        }}
      />

      {/* Section 1: Mill Purchase Contracts Table */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
        {/* Banner Bar Above Table */}
        <div className="bg-[#fff9db] border-b border-[#fcd34d] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
            <Calendar className="w-4 h-4 text-[#d97706]" />
            <span>Procurement Agreements & Empty Bag Allocation</span>
          </div>
          <span className="bg-[#059669] text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs">
            {filteredOrders.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left text-xs border border-slate-300">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold tracking-wider text-[11px] uppercase border-b-2 border-blue-900">
                <th className="py-2.5 px-3 border-r border-blue-400/40">Contract No</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Date</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Miller / Seller</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Packing</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Contract Qty</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Empty Bags Given</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Lifted in Trucks</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Remaining Bags</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Balance Qty</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Rate (2% CD)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Contract Value (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="13" className="py-12 text-center text-slate-400 border border-slate-300">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading purchase contracts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="13" className="py-16 text-center border border-slate-300">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No Purchase Contracts Found</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4 font-medium">
                      Create a procurement contract with rice mills to lock in agreed quantity and purchase rate.
                    </p>
                    <button
                      onClick={handleOpenCreateModal}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Purchase Order</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o, idx) => {
                  const contracted = Number(o.qty_qtls || 0);
                  const liftedQtls = Number(o.lifted_qtls || 0);
                  const liftedBags = Number(o.lifted_bags || 0);
                  const remainingQtls = Math.max(0, contracted - liftedQtls);
                  const bagsGiven = Number(o.bags_given || 0);
                  const remainingBags = Math.max(0, bagsGiven - liftedBags);
                  const pct = contracted > 0 ? Math.min(100, Math.round((liftedQtls / contracted) * 100)) : 0;
                  const rowBg = idx % 4 < 2 ? 'bg-[#edfdf1] hover:bg-[#dcfce7]' : 'bg-[#f7f2fb] hover:bg-[#ede5f7]';

                  return (
                    <tr key={o.id} className={`${rowBg} transition-colors`}>
                      <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap border-r border-b border-slate-300 align-middle">{o.contract_no}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap border-r border-b border-slate-300 align-middle">
                        {o.contract_date ? new Date(o.contract_date).toISOString().split('T')[0] : '-'}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 border-r border-b border-slate-300 align-middle">{o.seller_name}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap border-r border-b border-slate-300 align-middle">
                        <span className="px-2 py-0.5 rounded font-extrabold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                          {o.kg_per_bag || 30} KG
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300 align-middle">
                        {contracted.toLocaleString('en-IN')} <span className="text-[10px] text-slate-400 font-normal">Qtls</span>
                      </td>
                      <td className="py-2 px-2.5 text-right table-number border-r border-b border-slate-300 align-middle">
                        {bagsGiven > 0 ? (
                          <div className="flex flex-col items-end justify-center">
                            <div className="font-black text-slate-900 text-xs table-number leading-tight">
                              {bagsGiven.toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Bags</span>
                            </div>
                            <div className="flex items-center justify-end gap-1 flex-wrap mt-0.5">
                              {Object.entries(o.color_breakdown || {}).filter(([_, d]) => d.sent > 0).map(([col, d]) => {
                                const match = bagColors.find((c) => c.name.toLowerCase() === col.toLowerCase());
                                const hex = match?.color_code || '#2563eb';
                                return (
                                  <span
                                    key={col}
                                    className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-white text-slate-800 border border-slate-300 shrink-0"
                                    title={`${col}: ${d.sent.toLocaleString('en-IN')} Bags`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: hex }} />
                                    <span>{col}:</span>
                                    <strong className="text-slate-900">{d.sent.toLocaleString('en-IN')}</strong>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right table-number border-r border-b border-slate-300 align-middle">
                        <div className="flex flex-col items-end justify-center">
                          <div className="font-black text-blue-900 text-xs table-number leading-tight">
                            {liftedBags.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-blue-600 font-bold uppercase">Bags</span>
                          </div>
                          <div className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200 mt-0.5">
                            <span>{liftedQtls.toFixed(1)} Q</span>
                            <span>•</span>
                            <span>{pct}% Lifted</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right table-number border-r border-b border-slate-300 align-middle">
                        {bagsGiven > 0 ? (
                          remainingBags === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ 0 Bal
                            </span>
                          ) : (
                            <div className="flex flex-col items-end justify-center">
                              <div className="font-black text-amber-950 text-xs table-number leading-tight">
                                {remainingBags.toLocaleString('en-IN')}{' '}
                                <span className="text-[10px] text-amber-700 font-bold uppercase">at Mill</span>
                              </div>
                              <div className="flex items-center justify-end gap-1 flex-wrap mt-0.5">
                                {Object.entries(o.color_breakdown || {}).filter(([_, d]) => d.remaining > 0).map(([col, d]) => {
                                  const match = bagColors.find((c) => c.name.toLowerCase() === col.toLowerCase());
                                  const hex = match?.color_code || '#2563eb';
                                  return (
                                    <span
                                      key={col}
                                      className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-50 text-amber-950 border border-amber-300 shrink-0"
                                      title={`${col}: ${d.remaining.toLocaleString('en-IN')} Bags`}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: hex }} />
                                      <span>{col}:</span>
                                      <strong className="text-amber-950">{d.remaining.toLocaleString('en-IN')}</strong>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right table-number font-bold border-r border-b border-slate-300 align-middle">
                        <span className={remainingQtls === 0 ? 'text-emerald-800' : 'text-amber-800'}>
                          {remainingQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Qtls
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right table-number font-bold text-blue-900 border-r border-b border-slate-300 align-middle">
                        <div className="leading-tight">₹{Number(o.rate_per_qtl).toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-amber-800 font-medium">Bags: ₹{Number(o.egb_rate_per_qtl || 100)}/Qtl</div>
                        {Number(o.buying_brokerage_per_qtl) > 0 && (
                          <div className="text-[10px] text-purple-700 font-semibold truncate max-w-[130px]">
                            Brk: ₹{Number(o.buying_brokerage_per_qtl)}/Qtl{o.broker_name ? ` (${o.broker_name})` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300 align-middle">
                        ₹{(contracted * Number(o.rate_per_qtl)).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-b border-slate-300 align-middle">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center leading-tight ${
                          remainingQtls === 0 
                            ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]' 
                            : 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]'
                        }`}>
                          {remainingQtls === 0 ? 'COMPLETED ✓' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1.5 border-b border-slate-300 align-middle">
                        <button
                          onClick={() => handleOpenEditModal(o)}
                          title="Edit Contract"
                          className="p-1 rounded bg-white hover:bg-orange-50 text-orange-600 border border-slate-300 shadow-2xs inline-flex items-center cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(o)}
                            title="Delete Contract"
                            className="p-1 rounded bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 shadow-2xs inline-flex items-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-black text-slate-900">
                <td colSpan="4" className="py-2 px-3 uppercase text-[11px] tracking-wider">TOTAL</td>
                <td className="py-2 px-3 text-right table-number">{filteredOrders.reduce((a, o) => a + (Number(o.qty_qtls) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Qtls</td>
                <td className="py-2 px-3 text-right table-number">{filteredOrders.reduce((a, o) => a + (Number(o.bags_given) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">{filteredOrders.reduce((a, o) => a + (Number(o.lifted_bags) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">{filteredOrders.reduce((a, o) => a + Math.max(0, o.remaining_bags || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">{filteredOrders.reduce((a, o) => a + Math.max(0, o.remaining_qtls || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Qtls</td>
                <td className="py-2 px-3 text-right">—</td>
                <td className="py-2 px-3 text-right table-number">₹{filteredOrders.reduce((a, o) => a + (Number(o.qty_qtls) || 0) * (Number(o.rate_per_qtl) || 0), 0).toLocaleString('en-IN')}</td>
                <td /><td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AI-Era Packaging & Empty Gunny Bags (EGB) Live Godown & Mill Ledger */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
        {/* Banner Bar Above Section with Compact Toggle */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Package className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs sm:text-sm font-extrabold tracking-wide text-white">Empty Gunny Bags Live Godown Inventory</h3>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase">
                  Multi-Brand Auto Ledger
                </span>
              </div>
              <p className="text-[10px] text-slate-300">
                Dynamic tracking per brand color across all active mill agreements • In-Hand: <strong className="text-emerald-400">{totalEgbRemaining.toLocaleString('en-IN')} Bags</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-xs">
              {totalEgbRemaining > 0 ? `${totalEgbRemaining.toLocaleString('en-IN')} Bags Available` : 'All Bags Dispatched'}
            </span>
            <button
              onClick={() => setShowEgbLedger(!showEgbLedger)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-800/80 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors cursor-pointer border border-indigo-600 shadow-2xs"
            >
              <span>{showEgbLedger ? 'Hide Details' : 'View Godown Ledger'}</span>
              {showEgbLedger ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Sleek, Space-Efficient Horizontal Summary Bar */}
        {!showEgbLedger && dynamicColorStats.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live Bags In-Hand:</span>
            {dynamicColorStats.map((c) => {
              const match = bagColors.find((bc) => bc.name.toLowerCase() === c.name.toLowerCase());
              const hex = match?.color_code || '#2563eb';
              return (
                <div
                  key={c.name}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-300 shadow-2xs text-xs"
                >
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: hex }} />
                  <span className="font-bold text-slate-800 text-[11px]">{c.name}:</span>
                  <span className="font-black text-slate-900 table-number text-[11px]">{c.remaining.toLocaleString('en-IN')}</span>
                  <span className="text-[9.5px] text-slate-400 font-semibold">/ {c.sent.toLocaleString('en-IN')}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expanded View: Full Cards & Secondary Table */}
        {showEgbLedger && (
          <div>
            {/* Dynamic Color Breakdown KPI Cards */}
            {dynamicColorStats.length > 0 && (
              <div className="bg-slate-50/70 p-3.5 border-b border-slate-200">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5 flex items-center justify-between">
              <span>Dynamic Color Stock Summary (All Contracts)</span>
              <span className="text-slate-400 font-semibold">{dynamicColorStats.length} Registered Brand Colors</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {dynamicColorStats.map((c) => {
                const match = bagColors.find((bc) => bc.name.toLowerCase() === c.name.toLowerCase());
                const hex = match?.color_code || '#2563eb';
                const liftPct = c.sent > 0 ? Math.round((c.used / c.sent) * 100) : 0;
                return (
                  <div
                    key={c.name}
                    className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs hover:shadow-md transition-all relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-3 h-3 rounded-full inline-block shadow-xs"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="font-black text-xs text-slate-800">{c.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {totalEgbRemaining > 0 ? `${Math.round((c.remaining / totalEgbRemaining) * 100)}%` : '0%'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline text-[11px]">
                        <span className="text-slate-500 font-medium">In-Hand:</span>
                        <span className="font-extrabold text-sm text-slate-900 table-number">
                          {c.remaining.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Sent: {c.sent.toLocaleString('en-IN')}</span>
                        <span className="text-blue-600 font-semibold">Lifted: {c.used.toLocaleString('en-IN')}</span>
                      </div>
                      {/* Mini visual progress bar */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, liftPct)}%`,
                            backgroundColor: hex,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unified Contracts Empty Bag Inventory Ledger Table */}
        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left text-xs border border-slate-300">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold tracking-wider text-[11px] uppercase border-b-2 border-blue-900">
                <th className="py-2.5 px-3 border-r border-blue-400/40">Contract / Mill</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Total Bags Given</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Allocated by Brand Color</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Lifted in Trucks</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Remaining Bags (In-Hand)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Balance Breakdown by Color</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-slate-400">
                    No procurement agreements found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const bagsGiven = Number(o.bags_given) || 0;
                  const liftedBags = Number(o.lifted_bags) || 0;
                  const remainingBags = Math.max(0, Number(o.remaining_bags) || (bagsGiven - liftedBags));
                  const cb = o.color_breakdown || {};
                  const cbEntries = Object.entries(cb);
                  const isFullyLifted = bagsGiven > 0 && remainingBags === 0;

                  return (
                    <tr key={`egb-ledger-${o.id}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-b border-slate-300">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-extrabold text-[11px]">
                            {o.contract_no}
                          </span>
                          <span className="truncate max-w-[160px] font-bold text-slate-900" title={o.seller_name}>
                            {o.seller_name}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                          {o.contract_date ? new Date(o.contract_date).toLocaleDateString('en-IN') : ''} • {o.kg_per_bag || 30} KG Packing
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-slate-900 border-r border-b border-slate-300">
                        <span className="text-sm">{bagsGiven.toLocaleString('en-IN')}</span>{' '}
                        <span className="text-[10px] text-slate-400 font-normal">Bags</span>
                      </td>

                      <td className="py-2.5 px-3 text-center border-r border-b border-slate-300">
                        {cbEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {cbEntries.filter(([_, d]) => d.sent > 0).map(([col, d]) => {
                              const match = bagColors.find((c) => c.name.toLowerCase() === col.toLowerCase());
                              const hex = match?.color_code || '#2563eb';
                              return (
                                <span
                                  key={col}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                                >
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: hex }} />
                                  <span>{col}:</span>
                                  <strong className="text-slate-900">{d.sent.toLocaleString('en-IN')}</strong>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right table-number border-r border-b border-slate-300">
                        <div className="font-bold text-blue-900 text-xs">
                          {liftedBags.toLocaleString('en-IN')} Bags
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {bagsGiven > 0 ? `${Math.round((liftedBags / bagsGiven) * 100)}% Lifted` : '0%'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right table-number border-r border-b border-slate-300">
                        <div className={`font-black text-sm ${isFullyLifted ? 'text-emerald-700' : 'text-amber-950'}`}>
                          {remainingBags.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] uppercase font-bold text-slate-500">Left</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center border-r border-b border-slate-300">
                        {isFullyLifted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ 0 Bags Remaining
                          </span>
                        ) : cbEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {cbEntries.filter(([_, d]) => d.remaining > 0).map(([col, d]) => {
                              const match = bagColors.find((c) => c.name.toLowerCase() === col.toLowerCase());
                              const hex = match?.color_code || '#2563eb';
                              return (
                                <span
                                  key={col}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-950 border border-amber-300 shadow-2xs"
                                >
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: hex }} />
                                  <span>{col}:</span>
                                  <strong className="text-amber-900">{d.remaining.toLocaleString('en-IN')}</strong>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center border-r border-b border-slate-300">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center leading-tight ${
                            isFullyLifted
                              ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]'
                              : 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]'
                          }`}
                        >
                          {isFullyLifted ? 'Lifted (0 Bal)' : 'In Godown / Mill'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right border-b border-slate-300">
                        <button
                          onClick={() => handleOpenEditModal(o)}
                          className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit Bags</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-[#e2e8f0] font-extrabold text-slate-900 text-xs border-t-2 border-slate-400">
              <tr>
                <td className="py-2.5 px-3">Total Packaging In Circulation:</td>
                <td className="py-2.5 px-3 text-right table-number">{totalEgbAllocated.toLocaleString('en-IN')} Bags</td>
                <td className="py-2.5 px-3 text-center text-slate-500 font-semibold">{dynamicColorStats.length} Colors Active</td>
                <td className="py-2.5 px-3 text-right table-number text-blue-900">{totalEgbLifted.toLocaleString('en-IN')} Bags ({overallLiftPct}%)</td>
                <td className="py-2.5 px-3 text-right table-number text-emerald-950 font-black">{totalEgbRemaining.toLocaleString('en-IN')} Bags</td>
                <td colSpan="3" className="py-2.5 px-3 text-slate-500 text-[11px] font-normal italic">
                  * Dynamic real-time sync across truck dispatches
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )}
  </div>

      {/* Modal: Adjust EGB Stock (manual correction / mixed-brand split) */}
      <Modal isOpen={!!adjustEgb} onClose={() => setAdjustEgb(null)} title={`Adjust Bag Stock In-Hand — ${adjustEgb?.seller_name || ''}`}>
        <div className="space-y-4 text-xs font-medium">
          <p className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-indigo-900">
            Use this to correct the physical count at any time (mixed-brand split, damaged bags, returns). Trucks of a single color deduct automatically.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {['blue_bags', 'orange_bags', 'green_bags'].map((k) => (
              <div key={k}>
                <label className="block text-slate-700 font-bold mb-1 capitalize">{k.replace('_bags', '')}</label>
                <input
                  type="number"
                  value={egbForm[k]}
                  onChange={(e) => setEgbForm({ ...egbForm, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['total_bags', 'Total Bags'], ['tons', 'Tons'], ['no_of_bundles', 'Bundles']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-slate-700 font-bold mb-1">{label}</label>
                <input
                  type="number"
                  step="any"
                  value={egbForm[k]}
                  onChange={(e) => setEgbForm({ ...egbForm, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['rc_tempo_bus', 'Bus/Tempo Freight (₹)'], ['lf_per_qtl', 'LF / Qtl (₹)']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-slate-700 font-bold mb-1">{label}</label>
                <input
                  type="number"
                  step="any"
                  value={egbForm[k]}
                  onChange={(e) => setEgbForm({ ...egbForm, [k]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
            <button type="button" onClick={() => setAdjustEgb(null)} className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button onClick={handleSaveEgbAdjust} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer">Save Stock</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Create or Edit Purchase Contract */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingOrderId ? "Edit Purchase Order Contract" : "Create Purchase Order Contract"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Contract No. *</label>
              <input
                type="text"
                required
                maxLength={20}
                placeholder="e.g. PO-1002"
                value={formData.contract_no}
                onChange={(e) => setFormData({ ...formData, contract_no: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Contract Date *</label>
              <input
                type="date"
                required
                value={formData.contract_date}
                onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Seller / Rice Mill Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sri Krishna Agro Mills"
                value={formData.seller_name}
                onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Mill GSTIN Number <span className="text-[10px] text-slate-400 font-semibold">(15 characters)</span>
              </label>
              <input
                type="text"
                maxLength={15}
                placeholder="09AAECA9674R1ZN"
                value={formData.gst_no}
                onChange={(e) => setFormData({ ...formData, gst_no: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mill Address / Location</label>
            <input
              type="text"
              placeholder="e.g. Galla Mandi, Bahraich, Uttar Pradesh"
              value={formData.seller_address}
              onChange={(e) => setFormData({ ...formData, seller_address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Quantity, Packaging Size (KG) & Rate */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Quantity & Bag Packaging Specifications</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Packing (KG/Bag) *</label>
                <div className="flex space-x-1">
                  <select
                    value={['30', '25', '26', '50'].includes(String(formData.kg_per_bag)) ? String(formData.kg_per_bag) : 'custom'}
                    onChange={(e) => handleKgPerBagChange(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                  >
                    <option value="30">30 KG</option>
                    <option value="25">25 KG</option>
                    <option value="26">26 KG</option>
                    <option value="50">50 KG</option>
                    <option value="custom">Custom KG</option>
                  </select>
                </div>
                {!['30', '25', '26', '50'].includes(String(formData.kg_per_bag)) && (
                  <div className="flex items-center space-x-1 mt-2">
                    <span className="text-[11px] font-bold text-slate-600">Custom:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="e.g. 26"
                      value={['30', '25', '26', '50'].includes(String(formData.kg_per_bag)) ? '' : (Number.isFinite(Number(formData.kg_per_bag)) ? formData.kg_per_bag : '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && Number(v) > 0) handleKgPerBagChange(v);
                      }}
                      className="w-24 px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Total Bags</label>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={formData.bags}
                  onChange={(e) => handleBagsChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Contract Qty (Qtls) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 300.00"
                  value={formData.qty_qtls}
                  onChange={(e) => setFormData({ ...formData, qty_qtls: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Purchase Rate (₹/Qtl) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 5240"
                  value={formData.rate_per_qtl}
                  onChange={(e) => setFormData({ ...formData, rate_per_qtl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800"
                />
              </div>
            </div>
          </div>

          {/* Inward Brokerage (Buying Brokerage) */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-950 block">Inward Brokerage Details (Buying Broker)</span>
              <span className="text-[11px] text-purple-700">Optional. Enter brokerage paid on inward purchases.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Buying Broker Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Broker / Direct"
                  value={formData.broker_name}
                  onChange={(e) => setFormData({ ...formData, broker_name: e.target.value })}
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Buying Brokerage (₹/Qtl)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5 or 10"
                  value={formData.buying_brokerage_per_qtl}
                  onChange={(e) => setFormData({ ...formData, buying_brokerage_per_qtl: e.target.value })}
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white font-bold text-purple-900"
                />
                <span className="text-[10px] text-slate-500">Brokerage per Quintal for buying/inward</span>
              </div>
            </div>
          </div>

          {/* Empty Bags Sent to Mill (Dynamic Color Breakdown) */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-950 block">
                  Empty Gunny Bags Sent to Mill (Dynamic Colors & Brands)
                </span>
                <span className="text-[11px] text-amber-800">
                  Enter quantity sent by color. Deductions will be calculated automatically when trucks arrive.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingCustomColor(!isAddingCustomColor)}
                className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg shadow-2xs flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Color</span>
              </button>
            </div>

            {/* Inline Quick Add Color Bar */}
            {isAddingCustomColor && (
              <div className="p-2.5 bg-white border border-amber-300 rounded-lg flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700">New Color Name:</span>
                <input
                  type="text"
                  placeholder="e.g. Purple / Jute / Pink"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 font-semibold"
                />
                <span className="text-[11px] font-bold text-slate-700">Hex:</span>
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-7 h-7 p-0.5 border border-slate-300 rounded cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleAddInlineColor}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold cursor-pointer"
                >
                  Save Color
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomColor(false)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Dynamic Grid of Color Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {bagColors.map((col) => {
                const val = formData.brand_colors?.[col.name] ?? '';
                return (
                  <div key={col.id || col.name} className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <label className="flex items-center space-x-1.5 text-slate-700 font-bold mb-1">
                      <span
                        className="w-3 h-3 rounded-full border border-black/10 inline-block shrink-0"
                        style={{ backgroundColor: col.color_code || '#2563eb' }}
                      />
                      <span className="truncate">{col.name} Bags</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={val}
                      onChange={(e) => handleDynamicBagColorChange(col.name, e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-amber-500 text-slate-900 font-bold text-sm"
                    />
                  </div>
                );
              })}
            </div>

            {/* Total Bags, Manual Bag Rate & Transport Cost summary row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Total Empty Bags Allocated</label>
                <input
                  type="number"
                  readOnly
                  placeholder="Total bags"
                  value={formData.bags_given}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-amber-100/60 font-black text-amber-950 text-sm"
                />
                <span className="text-[10px] text-slate-500">Auto-summed from configured color counts</span>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Empty Bags Rate (₹/Qtl) <span className="text-amber-800 font-medium text-[10px]">(Manual Entry)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                  value={formData.egb_rate_per_qtl}
                  onChange={(e) => setFormData({ ...formData, egb_rate_per_qtl: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white font-bold text-slate-900"
                />
                <span className="text-[10px] text-slate-500">Manual bag cost rate for this contract</span>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Bus / Tempo Transport Freight (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 3500"
                  value={formData.bag_transport_cost}
                  onChange={(e) => setFormData({ ...formData, bag_transport_cost: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white font-semibold"
                />
                <span className="text-[10px] text-slate-500">Freight paid to send bags to mill</span>
              </div>
            </div>
          </div>

          {/* Live Calculation Preview Box */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Agreed Total Contract Value:</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-emerald-800">
                ₹{calcContractValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span className="block text-[10px] text-emerald-600 font-medium">
                ({calcQty} Qtls {formData.kg_per_bag ? `@ ${Number(formData.kg_per_bag)}KG` : ''} × ₹{calcRate}/Qtl)
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
            >
              {editingOrderId ? 'Update Contract' : 'Save Contract'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
