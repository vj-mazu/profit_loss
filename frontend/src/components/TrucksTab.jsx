import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  CheckCircle, 
  Clock, 
  Eye, 
  AlertCircle, 
  Trash2, 
  Edit, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Calendar,
  Search
} from 'lucide-react';
import api from '../services/api';
import FilterBar from './FilterBar';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { exportTrucksPdf } from '../utils/pdfExport';

export default function TrucksTab({ onSelectTruckForSales, onSelectTruckForSettlement }) {
  const { isAdmin } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [brand, setBrand] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState(null);

  // Bag Colors master list for dynamic brand options
  const [bagColors, setBagColors] = useState([
    { id: 'blue', name: 'Blue', color_code: '#2563eb' },
    { id: 'orange', name: 'Orange', color_code: '#ea580c' },
    { id: 'green', name: 'Green', color_code: '#16a34a' },
    { id: 'red', name: 'Red', color_code: '#dc2626' },
    { id: 'yellow', name: 'Yellow', color_code: '#ca8a04' },
    { id: 'white', name: 'White', color_code: '#64748b' },
  ]);

  // High-Scale Cursor Pagination state
  const [limit, setLimit] = useState(50);
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');

  // Form State for Truck - Dynamic Bag Weight (25, 26, 30, 50, custom) and Multi-Brand Support
  const [formData, setFormData] = useState({
    order_id: '',
    truck_serial: '',
    truck_number: '',
    truck_lf: '',
    date: new Date().toISOString().split('T')[0],
    purchase_bill_no: '',
    seller_name: '',
    kg_per_bag: '30',
    bags: '',
    qty_qtls: '',
    rate_per_qtl: '',
    buying_brokerage_per_qtl: '',
    broker_name: '',
    lorry_advance: '',
    brand: 'BLUE',
    selected_brands: ['BLUE'],
    brand_breakdown: {},
    origin_location: '',
    dest_location: '',
    unloading_date: new Date().toISOString().split('T')[0],
    status: 'UNLOADED',
    remarks: '',
  });

  const loadTrucks = async (targetCursor = cursor) => {
    try {
      setLoading(true);
      const [trucksRes, ordersRes, mastersRes] = await Promise.all([
        api.getTrucks({
          status,
          brand,
          search,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          month: month !== 'ALL' ? month : undefined,
          limit,
          cursor: targetCursor || undefined,
        }),
        api.getOrders(),
        api.getMasters().catch(() => ({ data: {} })),
      ]);

      if (trucksRes.data?.data) {
        setTrucks(trucksRes.data.data);
        setHasMore(trucksRes.data.hasMore);
        setNextCursor(trucksRes.data.nextCursor);
      } else {
        setTrucks(Array.isArray(trucksRes.data) ? trucksRes.data : []);
      }

      setOrders(ordersRes.data?.orders || []);
      if (mastersRes.data?.bag_colors?.length > 0) {
        setBagColors(mastersRes.data.bag_colors);
      }
    } catch (err) {
      console.error('Failed to load trucks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setCursor(null);
      setCursorHistory([]);
      loadTrucks(null);
    }, search ? 250 : 0);

    return () => clearTimeout(handler);
  }, [status, brand, search, limit, startDate, endDate, month]);

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor]);
    setCursor(nextCursor);
    loadTrucks(nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const target = prev.pop();
    setCursorHistory(prev);
    setCursor(target);
    loadTrucks(target);
  };

  const handleResetPagination = () => {
    setSearch('');
    setStatus('ALL');
    setBrand('ALL');
    setStartDate('');
    setEndDate('');
    setMonth('ALL');
    setCursor(null);
    setCursorHistory([]);
    loadTrucks(null);
  };

  const computeNextTruckSerial = (orderId, currentTruckId = null) => {
    if (!orderId) {
      return `Truck ${trucks.length + 1}`;
    }
    const selectedOrder = orders.find((o) => String(o.id) === String(orderId));
    const localOrderTrucks = trucks.filter(
      (t) => String(t.order_id) === String(orderId) && t.id !== currentTruckId
    );
    const backendCount = Number(selectedOrder?.trucks_count || 0);
    const count = Math.max(backendCount, localOrderTrucks.length);
    return `Truck ${count + 1}`;
  };

  const handleOpenCreateModal = () => {
    setEditingTruckId(null);
    const firstActiveOrder = orders.find((o) => Number(o.remaining_bags) > 0) || orders[0];
    const initialOrderId = firstActiveOrder ? firstActiveOrder.id : '';
    const initialSerial = computeNextTruckSerial(initialOrderId, null);
    const initialSeller = firstActiveOrder ? (firstActiveOrder.seller_name || '') : '';
    const initialRate = firstActiveOrder ? (firstActiveOrder.rate_per_qtl || '') : '';
    const initialKg = firstActiveOrder?.kg_per_bag ? String(firstActiveOrder.kg_per_bag) : '30';

    let recommendedBrand = 'BLUE';
    if (firstActiveOrder?.color_breakdown) {
      const availableEntry = Object.entries(firstActiveOrder.color_breakdown).find(([_, d]) => d.remaining > 0);
      if (availableEntry) recommendedBrand = availableEntry[0].toUpperCase();
    }

    setFormData({
      order_id: initialOrderId,
      truck_serial: initialSerial,
      truck_number: '',
      truck_lf: '',
      date: new Date().toISOString().split('T')[0],
      purchase_bill_no: '',
      seller_name: initialSeller,
      kg_per_bag: initialKg,
      bags: '',
      qty_qtls: '',
      rate_per_qtl: initialRate,
      buying_brokerage_per_qtl: firstActiveOrder ? (firstActiveOrder.buying_brokerage_per_qtl || '') : '',
      broker_name: firstActiveOrder ? (firstActiveOrder.broker_name || '') : '',
      lorry_advance: '',
      brand: recommendedBrand,
      selected_brands: [recommendedBrand],
      brand_breakdown: {},
      origin_location: '',
      dest_location: '',
      unloading_date: new Date().toISOString().split('T')[0],
      status: 'UNLOADED',
      remarks: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (truck) => {
    setEditingTruckId(truck.id);
    const truckKg = truck.kg_per_bag || 30;

    let parsedBreakdown = {};
    if (truck.brand_breakdown) {
      if (typeof truck.brand_breakdown === 'object') {
        parsedBreakdown = truck.brand_breakdown;
      } else {
        try { parsedBreakdown = JSON.parse(truck.brand_breakdown); } catch (e) { parsedBreakdown = {}; }
      }
    }

    let initialSelected = [];
    if (Object.keys(parsedBreakdown).length > 0) {
      initialSelected = Object.keys(parsedBreakdown);
    } else if (truck.brand) {
      const parts = truck.brand.split(/[\+\/]/).map((s) => s.trim().toUpperCase().replace(/\s*\(\d+\)/, '')).filter(Boolean);
      initialSelected = parts.length > 0 ? parts : [truck.brand.trim().toUpperCase()];
      if (initialSelected.length === 1 && truck.bags) {
        parsedBreakdown = { [initialSelected[0]]: String(truck.bags) };
      }
    } else {
      initialSelected = ['BLUE'];
    }

    setFormData({
      order_id: truck.order_id || '',
      truck_serial: truck.truck_serial || '',
      truck_number: truck.truck_number || '',
      truck_lf: truck.truck_lf || '',
      date: truck.date ? new Date(truck.date).toISOString().split('T')[0] : '',
      purchase_bill_no: truck.purchase_bill_no || '',
      seller_name: truck.seller_name || '',
      kg_per_bag: String(truckKg),
      bags: truck.bags || '',
      qty_qtls: truck.qty_qtls || '',
      rate_per_qtl: truck.rate_per_qtl || '',
      buying_brokerage_per_qtl: truck.buying_brokerage_per_qtl !== undefined && truck.buying_brokerage_per_qtl !== null ? truck.buying_brokerage_per_qtl : '',
      broker_name: truck.broker_name || '',
      lorry_advance: truck.lorry_advance || '',
      brand: truck.brand || initialSelected.join(' + '),
      selected_brands: initialSelected,
      brand_breakdown: parsedBreakdown,
      origin_location: truck.origin_location || '',
      dest_location: truck.dest_location || '',
      unloading_date: truck.unloading_date ? new Date(truck.unloading_date).toISOString().split('T')[0] : (truck.date ? new Date(truck.date).toISOString().split('T')[0] : ''),
      status: truck.status || 'UNLOADED',
      remarks: truck.remarks || '',
    });
    setIsModalOpen(true);
  };

  const handleOrderSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setFormData((prev) => ({ 
        ...prev, 
        order_id: '',
        truck_serial: `Truck ${trucks.length + 1}`
      }));
      return;
    }
    const selectedOrder = orders.find((o) => String(o.id) === String(selectedId));
    if (selectedOrder) {
      const orderKg = selectedOrder.kg_per_bag ? Number(selectedOrder.kg_per_bag) : 30;
      let recommendedBrand = (formData.selected_brands && formData.selected_brands[0]) || formData.brand || 'BLUE';
      if (selectedOrder.color_breakdown) {
        const availableEntry = Object.entries(selectedOrder.color_breakdown).find(([_, d]) => d.remaining > 0);
        if (availableEntry) {
          recommendedBrand = availableEntry[0].toUpperCase();
        }
      }

      const nextSerial = computeNextTruckSerial(selectedOrder.id, editingTruckId);

      setFormData((prev) => {
        const b = Number(prev.bags) || 0;
        const computedQtls = b > 0 ? Math.round((b * orderKg / 100) * 100) / 100 : prev.qty_qtls;
        const currentBrands = prev.selected_brands?.length > 0 ? prev.selected_brands : [recommendedBrand];
        return {
          ...prev,
          order_id: selectedOrder.id,
          truck_serial: nextSerial,
          seller_name: selectedOrder.seller_name || prev.seller_name,
          rate_per_qtl: selectedOrder.rate_per_qtl || prev.rate_per_qtl,
          buying_brokerage_per_qtl: selectedOrder.buying_brokerage_per_qtl !== undefined && selectedOrder.buying_brokerage_per_qtl !== null ? selectedOrder.buying_brokerage_per_qtl : prev.buying_brokerage_per_qtl,
          broker_name: selectedOrder.broker_name || prev.broker_name,
          kg_per_bag: String(orderKg),
          brand: currentBrands.length === 1 ? currentBrands[0] : prev.brand,
          selected_brands: currentBrands,
          qty_qtls: computedQtls,
        };
      });
    }
  };

  const handleToggleBrand = (brandUpper) => {
    setFormData((prev) => {
      const current = prev.selected_brands || [];
      let updatedSelected;
      let updatedBreakdown = { ...(prev.brand_breakdown || {}) };

      if (current.includes(brandUpper)) {
        if (current.length === 1) {
          return prev; // keep at least 1 brand
        }
        updatedSelected = current.filter((b) => b !== brandUpper);
        delete updatedBreakdown[brandUpper];
      } else {
        updatedSelected = [...current, brandUpper];
      }

      if (updatedSelected.length === 1) {
        const singleBrand = updatedSelected[0];
        updatedBreakdown = { [singleBrand]: prev.bags || '' };
        return {
          ...prev,
          selected_brands: updatedSelected,
          brand_breakdown: updatedBreakdown,
          brand: singleBrand,
        };
      }

      // If multiple brands selected
      const composite = updatedSelected
        .map((b) => (updatedBreakdown[b] ? `${b} (${updatedBreakdown[b]})` : b))
        .join(' + ');

      return {
        ...prev,
        selected_brands: updatedSelected,
        brand_breakdown: updatedBreakdown,
        brand: composite,
      };
    });
  };

  const handleBreakdownBagChange = (brandUpper, bagVal) => {
    setFormData((prev) => {
      const updatedBreakdown = { ...(prev.brand_breakdown || {}), [brandUpper]: bagVal };
      const sum = Object.values(updatedBreakdown).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
      const kg = Number(prev.kg_per_bag) || 30;
      const computedQtls = sum > 0 ? Math.round((sum * kg / 100) * 100) / 100 : '';

      const composite = (prev.selected_brands || [])
        .map((b) => (updatedBreakdown[b] ? `${b} (${updatedBreakdown[b]})` : b))
        .join(' + ');

      return {
        ...prev,
        brand_breakdown: updatedBreakdown,
        bags: sum > 0 ? String(sum) : '',
        qty_qtls: computedQtls,
        brand: composite,
      };
    });
  };

  const handleDistributeEvenly = () => {
    setFormData((prev) => {
      const brands = prev.selected_brands || [];
      const totalB = Number(prev.bags) || 0;
      if (brands.length === 0 || totalB <= 0) return prev;

      const base = Math.floor(totalB / brands.length);
      const rem = totalB % brands.length;
      const updatedBreakdown = {};

      brands.forEach((b, idx) => {
        updatedBreakdown[b] = String(idx < rem ? base + 1 : base);
      });

      const composite = brands.map((b) => `${b} (${updatedBreakdown[b]})`).join(' + ');

      return {
        ...prev,
        brand_breakdown: updatedBreakdown,
        brand: composite,
      };
    });
  };

  const handleBagsChange = (bagsVal) => {
    const b = Number(bagsVal) || 0;
    const kg = Number(formData.kg_per_bag) || 30;
    const computedQtls = b > 0 ? Math.round((b * kg / 100) * 100) / 100 : '';

    setFormData((prev) => {
      const brands = prev.selected_brands || ['BLUE'];
      let updatedBreakdown = { ...(prev.brand_breakdown || {}) };
      let composite = prev.brand;

      if (brands.length === 1) {
        updatedBreakdown = { [brands[0]]: bagsVal };
        composite = brands[0];
      }

      return {
        ...prev,
        bags: bagsVal,
        qty_qtls: computedQtls,
        brand_breakdown: updatedBreakdown,
        brand: composite,
      };
    });
  };

  const handleKgPerBagChange = (kgVal) => {
    const kg = Number(kgVal) || 30;
    const b = Number(formData.bags) || 0;
    const computedQtls = b > 0 ? Math.round((b * kg / 100) * 100) / 100 : formData.qty_qtls;
    setFormData((prev) => ({
      ...prev,
      kg_per_bag: kgVal,
      qty_qtls: computedQtls,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const kg = Number(formData.kg_per_bag) || 30;
      const bags = Number(formData.bags) || 0;
      const computedQty = Number(formData.qty_qtls) || (bags * kg / 100);

      const isMultiBrand = (formData.selected_brands || []).length > 1;
      let finalBrandBreakdown = null;
      let finalBrand = formData.brand || 'BLUE';

      if (isMultiBrand) {
        finalBrandBreakdown = {};
        (formData.selected_brands || []).forEach((b) => {
          finalBrandBreakdown[b] = Number(formData.brand_breakdown?.[b]) || 0;
        });

        const breakdownSum = Object.values(finalBrandBreakdown).reduce((a, b) => a + b, 0);
        if (breakdownSum !== bags) {
          alert(`Calculation Error: Sum of bags in brand breakdown (${breakdownSum.toLocaleString('en-IN')}) does not match Total Bags (${bags.toLocaleString('en-IN')}). Please click 'Auto-Distribute Evenly' or adjust the color bag counts.`);
          return;
        }

      } else {
        const singleBrand = (formData.selected_brands && formData.selected_brands[0]) || formData.brand || 'BLUE';
        finalBrand = singleBrand;
        finalBrandBreakdown = { [singleBrand]: bags };
      }

      // Validate against linked purchase contract
      if (formData.order_id) {
        const linkedOrder = orders.find((o) => String(o.id) === String(formData.order_id));
        if (linkedOrder) {
          const editingTruck = editingTruckId ? trucks.find((t) => t.id === editingTruckId) : null;
          const prevTruckBags = editingTruck && String(editingTruck.order_id) === String(formData.order_id)
            ? Number(editingTruck.bags) || 0
            : 0;
          const orderRemainingTotal = Math.max(0, Number(linkedOrder.remaining_bags) || 0) + prevTruckBags;

          if (bags > orderRemainingTotal && Number(linkedOrder.bags_given) > 0) {
            alert(`Validation Error: Cannot lift ${bags.toLocaleString('en-IN')} bags. Only ${orderRemainingTotal.toLocaleString('en-IN')} bags remaining on Contract ${linkedOrder.contract_no}!`);
            return;
          }

          if (linkedOrder.color_breakdown) {
            for (const [colName, cnt] of Object.entries(finalBrandBreakdown || {})) {
              const countVal = Number(cnt) || 0;
              if (countVal <= 0) continue;
              const match = Object.entries(linkedOrder.color_breakdown).find(
                ([k]) => k.toUpperCase() === colName.toUpperCase()
              );
              if (match) {
                let prevColorBags = 0;
                if (editingTruck && String(editingTruck.order_id) === String(formData.order_id)) {
                  let eb = editingTruck.brand_breakdown;
                  if (typeof eb === 'string') {
                    try { eb = JSON.parse(eb); } catch (e) { eb = null; }
                  }
                  if (eb && typeof eb === 'object') {
                    const matchEb = Object.entries(eb).find(([k]) => k.toUpperCase() === colName.toUpperCase());
                    if (matchEb) prevColorBags = Number(matchEb[1]) || 0;
                  } else if (editingTruck.brand && editingTruck.brand.toUpperCase() === colName.toUpperCase()) {
                    prevColorBags = Number(editingTruck.bags) || 0;
                  }
                }
                const availableForCol = Math.max(0, Number(match[1].remaining) || 0) + prevColorBags;
                if (countVal > availableForCol && Number(match[1].sent) > 0) {
                  alert(`Validation Error: Cannot lift ${countVal.toLocaleString('en-IN')} bags of ${colName}. Only ${availableForCol.toLocaleString('en-IN')} bags of ${colName} remain on Contract ${linkedOrder.contract_no}!`);
                  return;
                }
              }
            }
          }
        }
      }

      const payload = {
        ...formData,
        order_id: formData.order_id ? Number(formData.order_id) : null,
        kg_per_bag: kg,
        bags,
        qty_qtls: computedQty,
        rate_per_qtl: Number(formData.rate_per_qtl) || 0,
        truck_lf: Number(formData.truck_lf) || 0,
        lorry_advance: Number(formData.lorry_advance) || 0,
        buying_brokerage_per_qtl: Number(formData.buying_brokerage_per_qtl) || 0,
        broker_name: formData.broker_name?.trim() || '',
        brand: finalBrand,
        brand_breakdown: finalBrandBreakdown,
      };

      if (editingTruckId) {
        await api.updateTruck(editingTruckId, payload);
      } else {
        await api.createTruck(payload);
      }
      setIsModalOpen(false);
      loadTrucks(cursor);
    } catch (err) {
      alert(err.response?.data?.message || (editingTruckId ? 'Failed to update truck dispatch' : 'Failed to create truck dispatch'));
    }
  };

  const handleMarkUnloaded = async (truck) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await api.updateTruck(truck.id, {
        unloading_date: today,
        status: 'UNLOADED',
      });
      loadTrucks(cursor);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update unloading status');
    }
  };

  const handleDelete = async (truck) => {
    if (window.confirm(`Are you sure you want to delete ${truck.truck_serial} (${truck.truck_number}) and all associated bills?`)) {
      try {
        await api.deleteTruck(truck.id);
        loadTrucks(cursor);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete truck');
      }
    }
  };

  const statusOptions = [
    { value: 'UNLOADED', label: 'Unloaded (Received)' },
    { value: 'SETTLED', label: 'Settled' },
  ];

  // Live calculation preview in modal
  const calcBags = Number(formData.bags) || 0;
  const calcKg = Number(formData.kg_per_bag) || 30;
  const calcQtls = Number(formData.qty_qtls) || (calcBags * calcKg / 100);
  const calcRate = Number(formData.rate_per_qtl) || 0;
  const calcLF = Number(formData.truck_lf) || 0;
  const calcAdvance = Number(formData.lorry_advance) || 0;
  const calcPurchaseAmount = calcQtls * calcRate;
  const calcTotalFreight = calcQtls * calcLF;
  const calcLorryBalance = calcTotalFreight - calcAdvance;
  const breakdownSum = formData.selected_brands?.length > 1
    ? Object.values(formData.brand_breakdown || {}).reduce((acc, curr) => acc + (Number(curr) || 0), 0)
    : Number(formData.bags) || 0;

  return (
    <div className="space-y-6">
      {/* Section Header with Stats & New Truck Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-md p-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Truck className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Historical Arrivals · Paddy & Rice Stock</h1>
          </div>
          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500 mt-1">
            <span className="text-slate-600 font-medium">Dispatches & Physical Deliveries Ledger</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">{trucks.length} Trucks Recorded</span>
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Truck Dispatch</span>
        </button>
      </div>

      {/* Filter Bar (Matching screenshot with Daily, Weekly, Monthly presets) */}
      <FilterBar
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        statusOptions={statusOptions}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        month={month}
        setMonth={setMonth}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        placeholder="SL No, WB No, Lorry, Bill, Miller, Party..."
        onReset={handleResetPagination}
        onExportAllPdf={() => exportTrucksPdf(trucks, 'Inward Trucks Dispatches (All Records)')}
        onExportWeekPdf={() => {
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
          const weekTrucks = trucks.filter((t) => t.date && new Date(t.date) >= sevenDaysAgo);
          exportTrucksPdf(weekTrucks.length > 0 ? weekTrucks : trucks, 'Inward Trucks Dispatches (Last 7 Days)');
        }}
        onExportDatePdf={(targetDate) => {
          const dateTrucks = trucks.filter((t) => (t.date && t.date.startsWith(targetDate)) || (t.unloading_date && t.unloading_date.startsWith(targetDate)));
          exportTrucksPdf(dateTrucks.length > 0 ? dateTrucks : trucks, `Inward Trucks Dispatches (${targetDate || 'Selected Date'})`);
        }}
      />

      {/* Trucks Table (Exact layout from user screenshot) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
        {/* Banner Bar Above Table */}
        <div className="bg-[#fff9db] border-b border-[#fcd34d] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
            <Calendar className="w-4 h-4 text-[#d97706]" />
            <span>Dispatches & Physical Deliveries Ledger</span>
          </div>
          <span className="bg-[#059669] text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs">
            {trucks.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left text-xs border border-slate-300">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold tracking-wider text-[11px] uppercase border-b-2 border-blue-900">
                <th className="py-2.5 px-3 border-r border-blue-400/40">Serial</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Truck Number</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">PO Contract</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Date</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Bill No</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Party / Miller</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bags</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Packing</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Qtls</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Rate</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">LF</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Advance (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Net P&L (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Profit / Qtl</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Brand</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Unloaded Date</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="19" className="py-12 text-center text-slate-400 border border-slate-300">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading inward trucks...</span>
                    </div>
                  </td>
                </tr>
              ) : trucks.length === 0 ? (
                <tr>
                  <td colSpan="19" className="py-16 text-center border border-slate-300">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <Truck className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No Inward Trucks Recorded</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4 font-medium">
                      Your inward fleet database is clean. Click below to record your first dispatch.
                    </p>
                    <button
                      onClick={handleOpenCreateModal}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Truck Dispatch</span>
                    </button>
                  </td>
                </tr>
              ) : (
                trucks.map((t, idx) => {
                  const rowBg = idx % 4 < 2 ? 'bg-[#edfdf1] hover:bg-[#dcfce7]' : 'bg-[#f7f2fb] hover:bg-[#ede5f7]';
                  const kgVal = t.kg_per_bag || 30;
                  return (
                    <tr key={t.id} className={`${rowBg} transition-colors`}>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap border-r border-b border-slate-300">{t.truck_serial}</td>
                      <td className="py-2.5 px-3 font-bold table-number text-slate-900 whitespace-nowrap border-r border-b border-slate-300">{t.truck_number}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-b border-slate-300">
                        {t.linked_contract_no ? (
                          <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {t.linked_contract_no}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Direct</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap border-r border-b border-slate-300">
                        {t.date ? new Date(t.date).toISOString().split('T')[0] : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium border-r border-b border-slate-300">{t.purchase_bill_no || '-'}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[180px] truncate border-r border-b border-slate-300" title={t.seller_name}>
                        {t.seller_name}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300">{Number(t.bags).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-b border-slate-300">
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-extrabold border border-amber-300">
                          {kgVal} KG
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300">{Number(t.qty_qtls).toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right table-number font-medium border-r border-b border-slate-300">
                        ₹{Number(t.rate_per_qtl).toLocaleString('en-IN')}
                        {Number(t.buying_brokerage_per_qtl) > 0 && (
                          <span className="block text-[10px] text-purple-700 font-semibold">
                            Brk: ₹{Number(t.buying_brokerage_per_qtl)}/Qtl
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-blue-900 border-r border-b border-slate-300">₹{Number(t.truck_lf).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-slate-900 border-r border-b border-slate-300">
                        ₹{Number(t.purchase_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number text-slate-700 border-r border-b border-slate-300">
                        {Number(t.lorry_advance) > 0 ? (
                          <div>
                            <span className="font-bold text-amber-900">Adv: ₹{Number(t.lorry_advance).toLocaleString('en-IN')}</span>
                            <span className="block text-[10px] text-slate-600 font-semibold">
                              Bal: ₹{Math.max(0, Math.round((Number(t.truck_lf || 0) * Number(t.qty_qtls || 0)) - Number(t.lorry_advance || 0))).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-400 italic text-[11px]">Nil</span>
                            <span className="block text-[10px] text-slate-600 font-semibold">
                              Bal: ₹{Math.round(Number(t.truck_lf || 0) * Number(t.qty_qtls || 0)).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number border-r border-b border-slate-300">
                        {t.net_profit !== null && t.net_profit !== undefined ? (
                          <span className={`px-2 py-0.5 rounded-md font-black text-[11px] inline-block ${
                            Number(t.net_profit) >= 0 
                              ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]' 
                              : 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                          }`}>
                            {Number(t.net_profit) >= 0 ? `+₹${Number(t.net_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `-₹${Math.abs(Number(t.net_profit)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 italic">Pending Sales</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number border-r border-b border-slate-300">
                        {t.profit_per_qtl !== null && t.profit_per_qtl !== undefined ? (
                          <span className={`font-extrabold text-[11px] ${Number(t.profit_per_qtl) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {Number(t.profit_per_qtl) >= 0 ? `+₹${Number(t.profit_per_qtl).toFixed(1)}` : `-₹${Math.abs(Number(t.profit_per_qtl)).toFixed(1)}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center border-r border-b border-slate-300">
                        {(() => {
                          let breakdown = t.brand_breakdown;
                          if (typeof breakdown === 'string') {
                            try { breakdown = JSON.parse(breakdown); } catch (e) { breakdown = null; }
                          }
                          if (breakdown && typeof breakdown === 'object' && Object.keys(breakdown).length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1 justify-center items-center max-w-[180px] mx-auto">
                                {Object.entries(breakdown).map(([cName, count]) => {
                                  const upper = cName.toUpperCase();
                                  const colorClass = upper.includes('BLUE') ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                    upper.includes('ORANGE') ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                    upper.includes('GREEN') ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                    upper.includes('RED') ? 'bg-rose-100 text-rose-800 border-rose-300' :
                                    upper.includes('YELLOW') ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                    'bg-slate-100 text-slate-700 border-slate-300';
                                  return (
                                    <span key={cName} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${colorClass} whitespace-nowrap shadow-2xs`}>
                                      {upper}: <span className="font-black">{Number(count).toLocaleString('en-IN')}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.brand?.includes('BLUE') ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                              t.brand?.includes('ORANGE') ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                              t.brand?.includes('GREEN') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}>
                              {t.brand}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-800 whitespace-nowrap border-r border-b border-slate-300 font-bold table-number">
                        {t.unloading_date ? new Date(t.unloading_date).toISOString().split('T')[0] : (t.date ? new Date(t.date).toISOString().split('T')[0] : '-')}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-b border-slate-300">
                        {(() => {
                          const totalB = Number(t.bags) || 0;
                          const allocB = Number(t.allocated_bags) || 0;
                          const isFullySold = totalB > 0 && allocB >= totalB;
                          const isSettled = t.status === 'SETTLED' || isFullySold;

                          if (isSettled) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center bg-[#dcfce7] text-[#15803d] border border-[#86efac]">
                                SETTLED ✓
                              </span>
                            );
                          }
                          if (allocB > 0) {
                            return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center bg-amber-50 text-amber-900 border border-amber-300">
                                {allocB}/{totalB} SOLD
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center bg-blue-50 text-blue-800 border border-blue-200">
                              IN STOCK
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1 border-b border-slate-300">
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          title="Edit Truck"
                          className="p-1 rounded bg-white hover:bg-orange-50 text-orange-600 border border-slate-300 shadow-2xs inline-flex items-center cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectTruckForSales && onSelectTruckForSales(t.id)}
                          title="Allocate Sales Bills"
                          className="px-2 py-1 text-xs font-bold bg-white hover:bg-blue-50 text-blue-800 rounded border border-slate-300 shadow-2xs inline-flex items-center cursor-pointer"
                        >
                          Sales ({t.sales_count || 0})
                        </button>
                        <button
                          onClick={() => onSelectTruckForSettlement && onSelectTruckForSettlement(t.id)}
                          title="View P&L Ledger"
                          className="px-2 py-1 text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 rounded border border-slate-300 shadow-2xs inline-flex items-center cursor-pointer"
                        >
                          P&L
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(t)}
                            title="Delete truck"
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
                <td colSpan="6" className="py-2 px-3 uppercase text-[11px] tracking-wider">TOTAL (this page)</td>
                <td className="py-2 px-3 text-right table-number">{trucks.reduce((s, t) => s + (Number(t.bags) || 0), 0).toLocaleString('en-IN')}</td>
                <td />
                <td className="py-2 px-3 text-right table-number">{trucks.reduce((s, t) => s + (Number(t.qty_qtls) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                <td /><td />
                <td className="py-2 px-3 text-right table-number">₹{trucks.reduce((s, t) => s + (Number(t.purchase_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">₹{trucks.reduce((s, t) => s + (Number(t.lorry_advance) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">₹{trucks.reduce((s, t) => s + (Number(t.net_profit) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td /><td /><td /><td /><td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Cursor Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs font-semibold text-slate-600">
          <div className="flex items-center space-x-3">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <span className="text-slate-400">•</span>
            <span>Showing {trucks.length} records</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={cursorHistory.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasMore}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create or Edit Truck Dispatch */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTruckId ? "Edit Inward Truck Dispatch" : "Create Inward Truck Dispatch"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-800 font-bold text-xs">
                Link Purchase Order / Contract
              </label>
              {orders.length > 0 && (
                <span className="text-[10px] text-slate-500 font-semibold">
                  {orders.length} Contracts Available
                </span>
              )}
            </div>

            {/* Quick Search Input for Contracts */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by PO Contract # or Miller Name..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
              {orderSearch && (
                <button
                  type="button"
                  onClick={() => setOrderSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={formData.order_id}
              onChange={handleOrderSelect}
              className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 text-xs"
            >
              <option value="">-- Direct Dispatch (No Contract Linked) --</option>
              {orders
                .filter((o) => {
                  if (!orderSearch.trim()) return true;
                  const q = orderSearch.toLowerCase();
                  return (
                    (o.contract_no && o.contract_no.toLowerCase().includes(q)) ||
                    (o.seller_name && o.seller_name.toLowerCase().includes(q))
                  );
                })
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.contract_no} — {o.seller_name} ({o.remaining_bags || 0} bags left at mill)
                  </option>
                ))}
            </select>
          </div>

          {/* Active Contract Empty Bag Tracking Card */}
          {formData.order_id && (() => {
            const linked = orders.find((o) => String(o.id) === String(formData.order_id));
            if (!linked) return null;
            const remainingTotal = Math.max(0, linked.remaining_bags || 0);
            return (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-blue-950">
                    Empty Bag Warehouse Ledger ({linked.contract_no}):
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    remainingTotal > 0 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {remainingTotal.toLocaleString('en-IN')} Total Balance at Mill
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(linked.color_breakdown || {}).map(([col, d]) => (
                    <span
                      key={col}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center space-x-1 ${
                        d.remaining > 0
                          ? 'bg-white text-blue-900 border-blue-300 shadow-2xs'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                      }`}
                    >
                      <span>{col}:</span>
                      <span className={d.remaining > 0 ? 'text-amber-800 font-extrabold' : 'text-slate-400'}>
                        {d.remaining.toLocaleString('en-IN')} bal
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">
                        (Sent {d.sent}, Lifted {d.used})
                      </span>
                    </span>
                  ))}
                </div>
                {formData.bags && (
                  <div className="text-[11px] font-semibold text-blue-800 pt-1 border-t border-blue-200">
                    ℹ️ This dispatch will deduct <span className="font-bold">{formData.bags}</span> bags across{' '}
                    <span className="font-bold uppercase">
                      {formData.selected_brands?.length > 1
                        ? formData.selected_brands.map((b) => `${b} (${formData.brand_breakdown?.[b] || 0})`).join(' + ')
                        : formData.brand}
                    </span>{' '}
                    from this contract.
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold">Truck Serial *</label>
                {formData.order_id && (() => {
                  const linked = orders.find((o) => String(o.id) === String(formData.order_id));
                  const count = trucks.filter((t) => String(t.order_id) === String(formData.order_id) && t.id !== editingTruckId).length;
                  return (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      #{count + 1} for {linked?.contract_no || 'PO'} ({count} sent)
                    </span>
                  );
                })()}
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Truck 1"
                value={formData.truck_serial}
                onChange={(e) => setFormData({ ...formData, truck_serial: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Truck Registration No. * <span className="text-[10px] text-slate-400 font-semibold">(max 10, e.g. UP78KN1839)</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="UP78KN1839"
                value={formData.truck_number}
                onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Dispatch Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Bill No</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-09"
                value={formData.purchase_bill_no}
                onChange={(e) => setFormData({ ...formData, purchase_bill_no: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Dynamic Multi-Brand Selection & Inward Breakdown Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <label className="text-slate-800 font-bold text-xs uppercase tracking-wide flex items-center space-x-1.5">
                  <span>Brand Colors *</span>
                  <span className="text-[11px] text-slate-500 font-normal lowercase">(choose 1, 2, 3 or more brands on this truck)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Click colors to select all brands carried on this truck dispatch.
                </p>
              </div>
              {formData.selected_brands?.length > 1 && (
                <button
                  type="button"
                  onClick={handleDistributeEvenly}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                >
                  <span>⚡ Auto-Distribute Evenly</span>
                </button>
              )}
            </div>

            {/* Color chips */}
            <div className="flex flex-wrap gap-2">
              {bagColors.map((c) => {
                const upper = c.name.toUpperCase();
                const isSelected = (formData.selected_brands || []).includes(upper);

                let remainingAtMill = null;
                if (formData.order_id) {
                  const linked = orders.find((o) => String(o.id) === String(formData.order_id));
                  if (linked?.color_breakdown) {
                    const match = Object.entries(linked.color_breakdown).find(([k]) => k.toUpperCase() === upper);
                    if (match) remainingAtMill = match[1].remaining;
                  }
                }

                return (
                  <button
                    key={c.id || c.name}
                    type="button"
                    onClick={() => handleToggleBrand(upper)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
                      style={{ backgroundColor: c.color_code || '#2563eb' }}
                    />
                    <span>{upper}</span>
                    {remainingAtMill !== null && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                        {remainingAtMill} bal
                      </span>
                    )}
                    {isSelected && <span className="font-extrabold text-[11px]">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* If > 1 brand selected: input bags per color */}
            {formData.selected_brands?.length > 1 && (
              <div className="pt-2.5 border-t border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>Enter bag count for each brand color:</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded inline-block ${
                    breakdownSum === Number(formData.bags) && breakdownSum > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    Breakdown Sum: {breakdownSum.toLocaleString('en-IN')} Bags / Total: {Number(formData.bags || 0).toLocaleString('en-IN')} Bags
                    {breakdownSum === Number(formData.bags) && breakdownSum > 0 ? ' ✓' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {formData.selected_brands.map((bName) => {
                    const colorObj = bagColors.find((c) => c.name.toUpperCase() === bName);
                    const currentBags = formData.brand_breakdown?.[bName] ?? '';

                    let remCol = null;
                    if (formData.order_id) {
                      const linked = orders.find((o) => String(o.id) === String(formData.order_id));
                      if (linked?.color_breakdown) {
                        const match = Object.entries(linked.color_breakdown).find(([k]) => k.toUpperCase() === bName);
                        if (match) remCol = match[1].remaining;
                      }
                    }
                    const isOverLimit = remCol !== null && Number(currentBags) > remCol;

                    return (
                      <div
                        key={bName}
                        className={`p-2.5 bg-white rounded-lg border shadow-2xs space-y-1 transition-all ${
                          isOverLimit ? 'border-red-400 bg-red-50/50 ring-1 ring-red-400' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span className="flex items-center space-x-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block border border-black/10"
                              style={{ backgroundColor: colorObj?.color_code || '#2563eb' }}
                            />
                            <span>{bName}</span>
                          </span>
                          <span className={`text-[10px] font-semibold ${isOverLimit ? 'text-red-700 font-bold' : 'text-slate-400'}`}>
                            {remCol !== null ? `Avail: ${remCol}` : 'Bags'}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={currentBags}
                          onChange={(e) => handleBreakdownBagChange(bName, e.target.value)}
                          className={`w-full px-2.5 py-1 text-xs font-bold border rounded focus:ring-2 ${
                            isOverLimit
                              ? 'border-red-500 bg-white text-red-900 focus:ring-red-500'
                              : 'border-slate-300 text-slate-900 focus:ring-blue-500'
                          }`}
                        />
                        {isOverLimit && (
                          <span className="text-[10px] font-bold text-red-600 block leading-tight">
                            ⚠️ Exceeds {remCol} bal!
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Seller / Rice Mill Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Arohul Foods / Sri Krishna Agro"
              value={formData.seller_name}
              onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Dynamic Bag Packaging Weight Selector */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold text-xs">
                Packaging Weight
              </label>
              <span className="text-[11px] text-slate-600 font-semibold">
                {formData.bags ? `${formData.bags} Bags × ${formData.kg_per_bag || 30} KG = ${formData.qty_qtls || 0} Qtls` : 'Select KG per bag'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[25, 26, 30, 50].map((kg) => (
                <button
                  key={kg}
                  type="button"
                  onClick={() => handleKgPerBagChange(String(kg))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    String(formData.kg_per_bag) === String(kg)
                      ? 'bg-[#2b6cb0] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {kg} KG
                </button>
              ))}
              <div className="flex items-center space-x-1 ml-auto">
                <span className="text-[11px] font-bold text-slate-600">Custom:</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="KG"
                  value={formData.kg_per_bag}
                  onChange={(e) => handleKgPerBagChange(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Total Bags *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 1000"
                value={formData.bags}
                onChange={(e) => handleBagsChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Qty (Qtls) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 300.00"
                value={formData.qty_qtls}
                onChange={(e) => setFormData({ ...formData, qty_qtls: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Purchase Rate (₹/Qtl) *</label>
              <input
                type="number"
                step="any"
                min="1"
                required
                placeholder="e.g. 5240"
                value={formData.rate_per_qtl}
                onChange={(e) => setFormData({ ...formData, rate_per_qtl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Lorry Freight (LF ₹/Qtl) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 290"
                value={formData.truck_lf}
                onChange={(e) => setFormData({ ...formData, truck_lf: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Lorry Advance Paid (₹)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 20000"
                value={formData.lorry_advance}
                onChange={(e) => setFormData({ ...formData, lorry_advance: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Origin Mandi / State</label>
              <input
                type="text"
                placeholder="e.g. Uttar Pradesh"
                value={formData.origin_location}
                onChange={(e) => setFormData({ ...formData, origin_location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Destination Market / City</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra, Delhi, Nagpur, Pune..."
                value={formData.dest_location}
                onChange={(e) => setFormData({ ...formData, dest_location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Inward Brokerage (Buying Brokerage) */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-950 block">Inward / Buying Brokerage Details</span>
              <span className="text-[11px] text-purple-700">Auto-filled from contract (editable per truck)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Buying Broker Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Broker / Direct"
                  value={formData.broker_name}
                  onChange={(e) => setFormData({ ...formData, broker_name: e.target.value })}
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white font-medium text-slate-900 focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white font-bold text-purple-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Unloaded / Received Date *</label>
              <input
                type="date"
                required
                value={formData.unloading_date || formData.date}
                onChange={(e) => setFormData({ ...formData, unloading_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Remarks / Driver Notes</label>
              <input
                type="text"
                placeholder="e.g. Driver Phone: 9876543210, E-Way Bill No..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Live Calculation Preview Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center space-x-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>Total Purchase Amount:</span>
              </span>
              <span className="text-emerald-800 text-sm">
                ₹{calcPurchaseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Total Lorry Freight ({calcQtls} Qtls × ₹{calcLF}/Qtl):</span>
              <span className="font-semibold text-slate-700">₹{calcTotalFreight.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Pending Lorry Balance to Pay at Unload:</span>
              <span className="font-semibold text-amber-700">₹{calcLorryBalance.toLocaleString('en-IN')}</span>
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
              {editingTruckId ? 'Update Truck Dispatch' : 'Save Truck Dispatch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
