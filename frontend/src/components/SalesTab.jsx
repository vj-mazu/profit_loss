import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Edit, 
  ChevronLeft, 
  ChevronRight,
  Calculator,
  Search,
  Filter,
  Calendar
} from 'lucide-react';
import api from '../services/api';
import FilterBar from './FilterBar';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { exportSalesPdf } from '../utils/pdfExport';

export default function SalesTab({ selectedTruckId }) {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [truckFilter, setTruckFilter] = useState(selectedTruckId ? String(selectedTruckId) : 'ALL');
  const [filterDate, setFilterDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState(null);

  // High-Scale Cursor Pagination state
  const [limit, setLimit] = useState(50);
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [truckSearch, setTruckSearch] = useState('');

  const [parties, setParties] = useState([]);
  const [bagColors, setBagColors] = useState([
    { id: 'blue', name: 'Blue', color_code: '#2563eb' },
    { id: 'orange', name: 'Orange', color_code: '#ea580c' },
    { id: 'green', name: 'Green', color_code: '#16a34a' },
    { id: 'red', name: 'Red', color_code: '#dc2626' },
    { id: 'yellow', name: 'Yellow', color_code: '#ca8a04' },
    { id: 'white', name: 'White', color_code: '#64748b' },
  ]);

  // Form state for sales allocation - Clean without hardcoded dummy amounts
  const [formData, setFormData] = useState({
    truck_id: '',
    sale_bill_no: '',
    party_name: '',
    brokerage_per_qtl: '',
    bags: '',
    qty_qtls: '',
    brand_breakdown: {},
    actual_rate: '',
    billing_rate: '',
    received_amount: '',
    disc_pct: '5',
    discount_amount: '',
    cutting_amount: '',
    sale_received_date: '',
    payment_mode: 'RTGS/NEFT',
    payment_ref: '',
    payment_status: 'PENDING PAYMENT',
  });

  const loadData = async (targetCursor = cursor) => {
    try {
      setLoading(true);
      const [salesRes, trucksRes, mastersRes] = await Promise.all([
        api.getSales({
          status,
          search,
          truck_id: truckFilter !== 'ALL' ? truckFilter : undefined,
          limit,
          cursor: targetCursor || undefined,
        }),
        api.getTrucks({ limit: 100 }),
        api.getMasters().catch(() => ({ data: {} })),
      ]);

      if (salesRes.data?.data) {
        setSales(salesRes.data.data);
        setHasMore(salesRes.data.hasMore);
        setNextCursor(salesRes.data.nextCursor);
      } else {
        setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      }

      const truckList = trucksRes.data?.data || (Array.isArray(trucksRes.data) ? trucksRes.data : []);
      setTrucks(truckList);

      if (mastersRes.data?.parties) {
        setParties(mastersRes.data.parties);
      }
      if (mastersRes.data?.bag_colors?.length > 0) {
        setBagColors(mastersRes.data.bag_colors);
      }
    } catch (err) {
      console.error('Failed to load sales data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTruckId) {
      setTruckFilter(String(selectedTruckId));
    }
  }, [selectedTruckId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setCursor(null);
      setCursorHistory([]);
      loadData(null);
    }, search ? 250 : 0);

    return () => clearTimeout(handler);
  }, [status, search, truckFilter, limit]);

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor]);
    setCursor(nextCursor);
    loadData(nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const target = prev.pop();
    setCursorHistory(prev);
    setCursor(target);
    loadData(target);
  };

  const handleResetPagination = () => {
    setSearch('');
    setStatus('ALL');
    setTruckFilter('ALL');
    setCursor(null);
    setCursorHistory([]);
    loadData(null);
  };

  const handleOpenCreateModal = () => {
    setEditingSaleId(null);
    const defaultTruck = trucks.find((t) => String(t.id) === truckFilter) || trucks[0];
    setFormData({
      truck_id: defaultTruck ? defaultTruck.id : '',
      sale_bill_no: `MH-${sales.length + 1}`,
      party_name: '',
      brokerage_per_qtl: '',
      bags: '',
      qty_qtls: '',
      brand_breakdown: {},
      actual_rate: '',
      billing_rate: '',
      received_amount: '',
      disc_pct: '5',
      discount_amount: '',
      cutting_amount: '',
      sale_received_date: '',
      payment_mode: 'RTGS/NEFT',
      payment_ref: '',
      payment_status: 'PENDING PAYMENT',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sale) => {
    setEditingSaleId(sale.id);
    const discPctVal = sale.disc_pct
      ? String(Number(sale.disc_pct) > 1 ? Number(sale.disc_pct) : Math.round(Number(sale.disc_pct) * 100))
      : '5';

    let initialBreakdown = {};
    if (sale.brand_breakdown) {
      if (typeof sale.brand_breakdown === 'string') {
        try { initialBreakdown = JSON.parse(sale.brand_breakdown); } catch (e) { initialBreakdown = {}; }
      } else if (typeof sale.brand_breakdown === 'object') {
        initialBreakdown = { ...sale.brand_breakdown };
      }
    }

    setFormData({
      truck_id: sale.truck_id || '',
      sale_bill_no: sale.sale_bill_no || '',
      party_name: sale.party_name || '',
      brokerage_per_qtl: sale.brokerage_per_qtl !== undefined && sale.brokerage_per_qtl !== null ? sale.brokerage_per_qtl : '',
      bags: sale.bags || '',
      qty_qtls: sale.qty_qtls || '',
      brand_breakdown: initialBreakdown,
      actual_rate: sale.actual_rate || '',
      billing_rate: sale.billing_rate || '',
      received_amount: sale.received_amount || '',
      disc_pct: discPctVal,
      discount_amount: sale.discount_amount !== undefined && sale.discount_amount !== null ? String(sale.discount_amount) : '',
      cutting_amount: sale.cutting_amount !== undefined && sale.cutting_amount !== null ? String(sale.cutting_amount) : '',
      sale_received_date: sale.sale_received_date ? new Date(sale.sale_received_date).toISOString().split('T')[0] : '',
      payment_mode: sale.payment_mode || 'RTGS/NEFT',
      payment_ref: sale.payment_ref || '',
      payment_status: sale.payment_status || 'PENDING PAYMENT',
    });
    setIsModalOpen(true);
  };

  const handlePartyChange = (val) => {
    const matched = parties.find(
      (p) => p.name.toLowerCase().trim() === val.toLowerCase().trim()
    );
    setFormData((prev) => ({
      ...prev,
      party_name: val,
      brokerage_per_qtl: matched && (prev.brokerage_per_qtl === '' || prev.brokerage_per_qtl === undefined || prev.brokerage_per_qtl === null)
        ? (matched.default_brokerage ?? 0)
        : prev.brokerage_per_qtl,
    }));
  };

  const updateFinancialFields = (overrides = {}) => {
    setFormData((prev) => {
      const updated = { ...prev, ...overrides };
      const currentTruck = trucks.find((t) => Number(t.id) === Number(updated.truck_id));
      const kg = currentTruck?.kg_per_bag ? Number(currentTruck.kg_per_bag) : 30;
      const lf = currentTruck ? Number(currentTruck.truck_lf || 0) : 0;

      // Qty: if bags changed or overriding bags, recompute qty_qtls
      let qtls = updated.qty_qtls !== '' && updated.qty_qtls !== null && updated.qty_qtls !== undefined 
        ? Number(updated.qty_qtls) 
        : 0;
      if (overrides.bags !== undefined) {
        const b = Number(overrides.bags) || 0;
        qtls = b > 0 ? Math.round((b * kg / 100) * 100) / 100 : 0;
        updated.qty_qtls = qtls > 0 ? String(qtls) : '';
      } else if (overrides.qty_qtls !== undefined) {
        qtls = Number(overrides.qty_qtls) || 0;
      }

      // Billing Rate & Gross Delivered
      const billingRate = Number(updated.billing_rate) || 0;
      const discPct = updated.disc_pct !== '' && updated.disc_pct !== null && updated.disc_pct !== undefined
        ? Number(updated.disc_pct)
        : 5;
      const gross = qtls * billingRate;

      // Auto-compute discount if discount_amount was not manually typed in this call
      let discountAmount = updated.discount_amount;
      if (overrides.discount_amount === undefined) {
        if (gross > 0 && discPct > 0) {
          discountAmount = String(Math.round(gross * (discPct / 100) * 100) / 100);
        } else if (gross === 0) {
          discountAmount = '';
        }
      }
      updated.discount_amount = discountAmount;

      // Cutting Amount & Payment Status
      const rec = Number(updated.received_amount) || 0;
      const discVal = Number(discountAmount) || 0;
      const actualRate = Number(updated.actual_rate) || 0;
      const actualAmt = Math.round((actualRate - lf) * qtls * 100) / 100;

      if (rec > 0) {
        if (overrides.cutting_amount === undefined) {
          const compCutting = Math.round((actualAmt - rec - discVal) * 100) / 100;
          updated.cutting_amount = String(compCutting);
        }
        if (overrides.payment_status === undefined) {
          updated.payment_status = 'PAID';
        }
      } else {
        // If payment has not been received yet, Cutting is 0 or empty (not a negative number!)
        if (overrides.cutting_amount === undefined) {
          updated.cutting_amount = '';
        }
        if (overrides.payment_status === undefined) {
          updated.payment_status = 'PENDING PAYMENT';
        }
      }

      return updated;
    });
  };

  const handleAutoCalculateCutting = () => {
    const currentTruck = trucks.find((t) => Number(t.id) === Number(formData.truck_id));
    const kg = currentTruck?.kg_per_bag ? Number(currentTruck.kg_per_bag) : 30;
    const lf = currentTruck ? Number(currentTruck.truck_lf || 0) : 0;
    const qtls = Number(formData.qty_qtls) || ((Number(formData.bags) || 0) * kg / 100);
    const rec = Number(formData.received_amount) || 0;
    if (rec <= 0) {
      setFormData((prev) => ({ ...prev, cutting_amount: '0', payment_status: 'PENDING PAYMENT' }));
      return;
    }
    const billingRate = Number(formData.billing_rate) || 0;
    const discPct = Number(formData.disc_pct) || 5;
    const gross = qtls * billingRate;
    const disc = gross > 0 ? Math.round(gross * (discPct / 100) * 100) / 100 : (Number(formData.discount_amount) || 0);
    const actualRate = Number(formData.actual_rate) || 0;
    const actualAmt = Math.round((actualRate - lf) * qtls * 100) / 100;
    const cutting = Math.round((actualAmt - rec - disc) * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      discount_amount: String(disc),
      cutting_amount: String(cutting),
      payment_status: 'PAID',
    }));
  };

  // Calculate color inventory and available balance for the selected truck
  const getTruckColorInventory = () => {
    if (!formData.truck_id) return [];
    const trk = trucks.find((t) => Number(t.id) === Number(formData.truck_id));
    if (!trk) return [];

    let trkBreakdown = trk.brand_breakdown;
    if (typeof trkBreakdown === 'string') {
      try { trkBreakdown = JSON.parse(trkBreakdown); } catch (e) { trkBreakdown = null; }
    }

    const inwardMap = {};
    if (trkBreakdown && typeof trkBreakdown === 'object' && Object.keys(trkBreakdown).length > 0) {
      Object.entries(trkBreakdown).forEach(([col, cnt]) => {
        inwardMap[col] = Number(cnt) || 0;
      });
    } else if (trk.brand) {
      inwardMap[trk.brand] = Number(trk.bags) || 0;
    }

    const soldMap = {};
    sales
      .filter((s) => Number(s.truck_id) === Number(formData.truck_id) && s.id !== editingSaleId)
      .forEach((s) => {
        let sBreakdown = s.brand_breakdown;
        if (typeof sBreakdown === 'string') {
          try { sBreakdown = JSON.parse(sBreakdown); } catch (e) { sBreakdown = null; }
        }
        if (sBreakdown && typeof sBreakdown === 'object') {
          Object.entries(sBreakdown).forEach(([col, cnt]) => {
            soldMap[col] = (soldMap[col] || 0) + (Number(cnt) || 0);
          });
        }
      });

    const allColorKeys = Array.from(new Set([
      ...Object.keys(inwardMap),
      ...Object.keys(formData.brand_breakdown || {}),
    ]));

    return allColorKeys.map((col) => {
      const inward = inwardMap[col] || 0;
      const otherSold = soldMap[col] || 0;
      const available = Math.max(0, inward - otherSold);
      const selling = formData.brand_breakdown?.[col] !== undefined ? formData.brand_breakdown[col] : '';
      const sellingNum = Number(selling) || 0;
      const isOverSold = inward > 0 && sellingNum > available;
      const overSoldQty = sellingNum - available;
      const remaining = Math.max(0, available - sellingNum);
      return {
        colorName: col,
        inward,
        otherSold,
        available,
        selling,
        remaining,
        isOverSold,
        overSoldQty,
      };
    });
  };

  const handleColorBagsChange = (colorName, countVal) => {
    const updatedBreakdown = {
      ...(formData.brand_breakdown || {}),
      [colorName]: countVal === '' ? '' : (Number(countVal) || 0),
    };
    const totalBags = Object.values(updatedBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0);
    setFormData((prev) => ({
      ...prev,
      brand_breakdown: updatedBreakdown,
    }));
    updateFinancialFields({ bags: totalBags, brand_breakdown: updatedBreakdown });
  };

  const handleAddExtraColorToSale = (colorName) => {
    if (!colorName) return;
    setFormData((prev) => ({
      ...prev,
      brand_breakdown: {
        ...(prev.brand_breakdown || {}),
        [colorName]: '',
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.truck_id) {
      alert('Please select an inward truck for this sales bill');
      return;
    }

    // Strict Validation: Cannot sell more bags of any color than what is available on this truck!
    const inventory = getTruckColorInventory();
    for (const item of inventory) {
      const sellCount = Number(formData.brand_breakdown?.[item.colorName]) || 0;
      if (item.inward > 0 && sellCount > item.available) {
        alert(`Validation Error: Cannot sell ${sellCount.toLocaleString('en-IN')} bags of ${item.colorName}. Only ${item.available.toLocaleString('en-IN')} ${item.colorName} bags available in this truck dispatch!`);
        return;
      }
    }

    // Strict Validation: Cannot sell more total bags than available on this truck!
    const currentTruck = trucks.find((t) => Number(t.id) === Number(formData.truck_id));
    if (currentTruck) {
      const otherSoldTotal = sales
        .filter((s) => Number(s.truck_id) === Number(formData.truck_id) && s.id !== editingSaleId)
        .reduce((sum, s) => sum + (Number(s.bags) || 0), 0);
      const totalAvailableOnTruck = Math.max(0, (Number(currentTruck.bags) || 0) - otherSoldTotal);
      const requestedTotal = Number(formData.bags) || 0;
      if (requestedTotal > totalAvailableOnTruck) {
        alert(`Validation Error: Cannot sell ${requestedTotal.toLocaleString('en-IN')} bags. Only ${totalAvailableOnTruck.toLocaleString('en-IN')} total bags remaining on Truck ${currentTruck.truck_serial || currentTruck.truck_number}!`);
        return;
      }
    }

    try {
      const payload = {
        ...formData,
        truck_id: Number(formData.truck_id),
        brokerage_per_qtl: formData.brokerage_per_qtl !== '' && formData.brokerage_per_qtl !== null ? Number(formData.brokerage_per_qtl) : null,
        bags: Number(formData.bags) || 0,
        qty_qtls: Number(formData.qty_qtls) || (Number(formData.bags) * 30 / 100),
        actual_rate: Number(formData.actual_rate) || 0,
        billing_rate: Number(formData.billing_rate) || 0,
        received_amount: formData.received_amount ? Number(formData.received_amount) : null,
        disc_pct: formData.disc_pct !== '' && formData.disc_pct !== null ? (Number(formData.disc_pct) > 1 ? Number(formData.disc_pct) / 100 : Number(formData.disc_pct)) : 0.05,
        discount_amount: formData.discount_amount !== '' && formData.discount_amount !== null ? Number(formData.discount_amount) : null,
        cutting_amount: formData.cutting_amount !== '' && formData.cutting_amount !== null ? Number(formData.cutting_amount) : 0,
        sale_received_date: formData.sale_received_date || null,
        payment_mode: formData.payment_mode || null,
        payment_ref: formData.payment_ref || null,
        brand_breakdown: formData.brand_breakdown || {},
      };

      if (editingSaleId) {
        await api.updateSale(editingSaleId, payload);
      } else {
        await api.createSale(payload);
      }
      setIsModalOpen(false);
      loadData(cursor);
    } catch (err) {
      alert(err.response?.data?.message || (editingSaleId ? 'Failed to update sales bill' : 'Failed to save sales bill'));
    }
  };

  const handleDelete = async (sale) => {
    if (window.confirm(`Are you sure you want to delete sales bill ${sale.sale_bill_no} for ${sale.party_name}?`)) {
      try {
        await api.deleteSale(sale.id);
        loadData(cursor);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete sales bill');
      }
    }
  };

  const statusOptions = [
    { value: 'PAID', label: 'Paid in Full' },
    { value: 'PENDING PAYMENT', label: 'Pending Payment' },
    { value: 'CUTTING', label: 'Cutting Deducted' },
  ];

  // Active truck for calculation
  const activeTruck = trucks.find((t) => Number(t.id) === Number(formData.truck_id));
  const calcBags = Number(formData.bags) || 0;
  const calcQtls = Number(formData.qty_qtls) || (calcBags * 30 / 100);
  const calcBillingRate = Number(formData.billing_rate) || 0;
  const calcActualRate = Number(formData.actual_rate) || 0;
  const calcLF = activeTruck ? Number(activeTruck.truck_lf || 0) : 0;
  const calcGrossBillingAmount = calcQtls * calcBillingRate;
  const calcGrossActualAmount = calcQtls * calcActualRate;
  const calcLorryAmount = calcQtls * calcLF;
  const calcNetBillAmount = (calcBillingRate - calcLF) * calcQtls;
  const calcNetActualAmount = (calcActualRate - calcLF) * calcQtls;
  const calcBrokerageRate = formData.brokerage_per_qtl !== '' && formData.brokerage_per_qtl !== null ? Number(formData.brokerage_per_qtl) : null;
  const calcTotalBrokerage = calcBrokerageRate !== null ? (calcQtls * calcBrokerageRate) : null;

  // Excel 'Summary View' breakeven + over-allocation warning strip (client-side mirror of backend math)
  const previewWarnings = (() => {
    if (!activeTruck) return null;
    const hasRates = calcBillingRate > 0 && Number(formData.actual_rate) > 0;
    if (!hasRates) return null;
    const actualRate = Number(formData.actual_rate);
    const purchaseRate = Number(activeTruck.rate_per_qtl) || 0;
    const pr = purchaseRate;
    const effectiveBrokerage = calcBrokerageRate !== null ? calcBrokerageRate : (60 + 40);
    const breakevenRate = Math.ceil(
      pr + calcLF + pr * 0.006 + calcBillingRate * 0.0039 + 100 + 20 + effectiveBrokerage + actualRate * 0.05 - pr * 0.02
    );
    const belowBreakeven = calcBillingRate < breakevenRate;
    const warnings = [];
    // Over-allocation: sum of bags on all this truck's bills (excluding edited bill) vs truck capacity
    const soldBags = sales
      .filter((s) => Number(s.truck_id) === Number(activeTruck.id) && s.id !== editingSaleId)
      .reduce((sum, s) => sum + (Number(s.bags) || 0), 0);
    const capacity = Number(activeTruck.bags) || 0;
    if (soldBags + calcBags > capacity) {
      warnings.push(`This bill exceeds truck load: already allocated ${soldBags.toLocaleString('en-IN')} of ${capacity.toLocaleString('en-IN')} bags — adding ${calcBags.toLocaleString('en-IN')} now goes ${Math.max(0, soldBags + calcBags - capacity).toLocaleString('en-IN')} bags over.`);
    }
    return {
      breakevenRate,
      belowBreakeven,
      marginPerQtl: calcBillingRate - breakevenRate,
      lossPerQtl: breakevenRate - calcBillingRate,
      toIntWarnings: warnings,
    };
  })();

  return (
    <div className="space-y-6">
      {/* Section Header with Stats & New Bill Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-md p-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Wholesale Sales · Merchant Bills & Outflows</h1>
          </div>
          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500 mt-1">
            <span className="text-slate-600 font-medium">B2B Trade Receivables Ledger</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">{sales.length} Bills Recorded</span>
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Sales Bill</span>
        </button>
      </div>

      {/* Filter Bar with Truck Dropdown */}
      <div className="space-y-3">
        <FilterBar
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          statusOptions={statusOptions}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          placeholder="Fast search: Bill No (e.g. MH-01), Buyer Party, or Truck..."
          onReset={handleResetPagination}
          onExportAllPdf={() => exportSalesPdf(sales, 'Wholesale Sales Bills (All Records)')}
          onExportWeekPdf={() => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
            const weekSales = sales.filter((s) => s.sale_received_date && new Date(s.sale_received_date) >= sevenDaysAgo);
            exportSalesPdf(weekSales.length > 0 ? weekSales : sales, 'Wholesale Sales Bills (Last 7 Days)');
          }}
          onExportDatePdf={(targetDate) => {
            const dateSales = sales.filter((s) => s.sale_received_date && s.sale_received_date.startsWith(targetDate));
            exportSalesPdf(dateSales.length > 0 ? dateSales : sales, `Wholesale Sales Bills (${targetDate || 'Selected Date'})`);
          }}
        />

        {/* Quick Truck Selector Filter Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto py-1">
          <span className="text-xs font-bold text-slate-800 whitespace-nowrap">Filter by Truck:</span>
          <button
            onClick={() => setTruckFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              truckFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            All Trucks
          </button>
          {trucks.slice(0, 15).map((t) => (
            <button
              key={t.id}
              onClick={() => setTruckFilter(String(t.id))}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                truckFilter === String(t.id)
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-emerald-50'
              }`}
            >
              {t.truck_serial} ({t.truck_number})
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table (Exact layout from user screenshot) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden">
        {/* Banner Bar Above Table */}
        <div className="bg-[#fff9db] border-b border-[#fcd34d] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
            <Calendar className="w-4 h-4 text-[#d97706]" />
            <span>Merchant Bills & Consignment Ledger</span>
          </div>
          <span className="bg-[#059669] text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs">
            {sales.length} bills
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left text-xs border border-slate-300">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold tracking-wider text-[11px] uppercase border-b-2 border-blue-900">
                <th className="py-2.5 px-3 border-r border-blue-400/40">Sale Bill</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Truck</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40">Buyer Party</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bags</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Qtls</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Actual Rate</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Billing Rate</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Bill Amount (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Lorry Ded. (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Brokerage (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Breakeven Rate</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Received (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-left">Payment Date & Mode</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Cash Disc. (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-right">Cutting (₹)</th>
                <th className="py-2.5 px-3 border-r border-blue-400/40 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="17" className="py-12 text-center text-slate-400 border border-slate-300">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading wholesale sales bills...</span>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="17" className="py-16 text-center border border-slate-300">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No Sales Bills Recorded</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4 font-medium">
                      Split incoming truck consignments to wholesale merchant buyers with billing rates and delivery terms.
                    </p>
                    <button
                      onClick={handleOpenCreateModal}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Sales Bill</span>
                    </button>
                  </td>
                </tr>
              ) : (
                sales.map((s, idx) => {
                  const rowBg = idx % 4 < 2 ? 'bg-[#edfdf1] hover:bg-[#dcfce7]' : 'bg-[#f7f2fb] hover:bg-[#ede5f7]';
                  return (
                    <tr key={s.id} className={`${rowBg} transition-colors`}>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap border-r border-b border-slate-300">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-900 font-mono font-bold">
                          {s.sale_bill_no}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap font-medium border-r border-b border-slate-300">
                        {s.truck_serial} <span className="text-slate-500 font-mono text-[11px]">({s.truck_number})</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[170px] truncate border-r border-b border-slate-300" title={s.party_name}>
                        {s.party_name}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300">
                        <div>{Number(s.bags).toLocaleString('en-IN')}</div>
                        {(() => {
                          let bd = s.brand_breakdown;
                          if (typeof bd === 'string') {
                            try { bd = JSON.parse(bd); } catch (e) { bd = null; }
                          }
                          if (bd && typeof bd === 'object' && Object.keys(bd).length > 0) {
                            const activeColors = Object.entries(bd).filter(([_, c]) => Number(c) > 0);
                            if (activeColors.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1 justify-end mt-0.5">
                                  {activeColors.map(([col, count]) => (
                                    <span key={col} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                      {col}: {count}
                                    </span>
                                  ))}
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-slate-900 border-r border-b border-slate-300">{Number(s.qty_qtls).toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right table-number font-medium border-r border-b border-slate-300">₹{Number(s.actual_rate).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-slate-900 border-r border-b border-slate-300">₹{Number(s.billing_rate).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-slate-900 border-r border-b border-slate-300">
                        ₹{Number(s.bill_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-extrabold text-rose-700 border-r border-b border-slate-300">
                        -₹{Number(s.lorry_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-purple-900 border-r border-b border-slate-300">
                        {s.brokerage_amount !== null && s.brokerage_amount !== undefined ? (
                          <span title={`₹${s.brokerage_per_qtl || 0}/Qtl`}>
                            ₹{Number(s.brokerage_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            <span className="text-[10px] text-purple-600 block font-normal">(@₹{s.brokerage_per_qtl}/Q)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Auto</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-blue-900 border-r border-b border-slate-300">
                        ₹{Number(s.breakeven_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-bold text-emerald-800 border-r border-b border-slate-300">
                        {s.received_amount ? `₹${Number(s.received_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-left border-r border-b border-slate-300 whitespace-nowrap">
                        {s.sale_received_date ? (
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">
                              {new Date(s.sale_received_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold block">
                              {s.payment_mode || 'RTGS/NEFT'}{s.payment_ref ? ` • ${s.payment_ref}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Pending Date</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number text-slate-600 border-r border-b border-slate-300">
                        {Number(s.discount_amount) > 0 ? `₹${Number(s.discount_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right table-number font-semibold border-r border-b border-slate-300">
                        {Number(s.cutting_amount) !== 0 ? (
                          <span className={Number(s.cutting_amount) < 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                            {Number(s.cutting_amount) < 0 ? `-₹${Math.abs(Number(s.cutting_amount))}` : `+₹${Number(s.cutting_amount)}`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-b border-slate-300">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block text-center leading-tight ${
                          s.payment_status === 'PAID' ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]' :
                          s.payment_status === 'CUTTING' ? 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]' : 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                        }`}>
                          {s.payment_status === 'PAID' ? 'PAID ✓' : s.payment_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1 border-b border-slate-300">
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          title="Edit Sales Bill"
                          className="p-1 rounded bg-white hover:bg-orange-50 text-orange-600 border border-slate-300 shadow-2xs inline-flex items-center cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(s)}
                            title="Delete Sales Bill"
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
                <td colSpan="3" className="py-2 px-3 uppercase text-[11px] tracking-wider">TOTAL (this page)</td>
                <td className="py-2 px-3 text-right table-number">{sales.reduce((a, s) => a + (Number(s.bags) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">{sales.reduce((a, s) => a + (Number(s.qty_qtls) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                <td /><td />
                <td className="py-2 px-3 text-right table-number">₹{sales.reduce((a, s) => a + (Number(s.bill_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">₹{sales.reduce((a, s) => a + (Number(s.lorry_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number text-purple-900">₹{sales.reduce((a, s) => a + (Number(s.brokerage_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td />
                <td className="py-2 px-3 text-right table-number">₹{sales.reduce((a, s) => a + (Number(s.received_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td />
                <td className="py-2 px-3 text-right table-number">₹{sales.reduce((a, s) => a + (Number(s.discount_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right table-number">₹{sales.reduce((a, s) => a + (Number(s.cutting_amount) || 0), 0).toLocaleString('en-IN')}</td>
                <td /><td />
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
            <span>Showing {sales.length} bills</span>
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

      {/* Modal: Create or Edit Sales Bill */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingSaleId ? "Edit Wholesale Sales Bill" : "Create Wholesale Sales Bill"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold">Select Consignment Truck *</label>
                {trucks.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-semibold">{trucks.length} Trucks</span>
                )}
              </div>

              {/* Truck Search Box */}
              <div className="relative mb-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Truck #, Serial, PO or Miller..."
                  value={truckSearch}
                  onChange={(e) => setTruckSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
                {truckSearch && (
                  <button
                    type="button"
                    onClick={() => setTruckSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                required
                value={formData.truck_id}
                onChange={(e) => {
                  const tid = Number(e.target.value);
                  updateFinancialFields({ truck_id: tid });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 text-xs"
              >
                <option value="">-- Choose Truck --</option>
                {trucks
                  .filter((t) => {
                    if (!truckSearch.trim()) return true;
                    const q = truckSearch.toLowerCase();
                    return (
                      (t.truck_number && t.truck_number.toLowerCase().includes(q)) ||
                      (t.truck_serial && t.truck_serial.toLowerCase().includes(q)) ||
                      (t.seller_name && t.seller_name.toLowerCase().includes(q)) ||
                      (t.linked_contract_no && t.linked_contract_no.toLowerCase().includes(q))
                    );
                  })
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.truck_serial} • {t.truck_number} — {t.seller_name} ({t.qty_qtls} Q)
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Sale Bill Number * <span className="text-[10px] text-slate-400 font-semibold">(e.g. MH-01)</span>
              </label>
              <input
                type="text"
                required
                maxLength={12}
                placeholder="MH-01"
                value={formData.sale_bill_no}
                onChange={(e) => setFormData({ ...formData, sale_bill_no: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-bold">Buyer / Merchant Party Name *</label>
              {parties.some(p => p.name.toLowerCase().trim() === formData.party_name.toLowerCase().trim()) && (
                <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Matched Directory: {parties.find(p => p.name.toLowerCase().trim() === formData.party_name.toLowerCase().trim())?.city || 'Registered Party'}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              list="buyer-party-list"
              placeholder="Type or select buyer (e.g. Asraj Dhondiram / Mahaveer Traders)"
              value={formData.party_name}
              onChange={(e) => handlePartyChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
            />
            <datalist id="buyer-party-list">
              {parties.filter(p => p.type !== 'mill').map((p) => (
                <option key={p.id} value={p.name}>
                  {p.city ? `${p.city} • Default Brokerage: ₹${p.default_brokerage || 0}/Qtl` : `Default Brokerage: ₹${p.default_brokerage || 0}/Qtl`}
                </option>
              ))}
            </datalist>
          </div>

          {/* Multi-Color Bags Selling Breakdown (No 2-Color Limit!) */}
          {formData.truck_id && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-blue-950 block">
                    Bag Colors & Brands Sold (No limit - select 1, 2, 3 or more colors)
                  </span>
                  <span className="text-[11px] text-blue-800">
                    Enter bags sold for each color on this truck. Available stock will adjust automatically.
                  </span>
                </div>
                {/* Option to add any extra color from masters */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddExtraColorToSale(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-2 py-1 text-xs border border-blue-300 rounded-lg bg-white font-bold text-blue-900 cursor-pointer w-auto"
                  defaultValue=""
                >
                  <option value="" disabled>+ Add Another Color</option>
                  {bagColors.map((bc) => (
                    <option key={bc.id || bc.name} value={bc.name}>
                      {bc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show warning banner if any color or total is oversold */}
              {getTruckColorInventory().some((it) => it.isOverSold) && (
                <div className="p-2.5 bg-red-100 border border-red-300 rounded-lg text-red-900 font-bold text-xs flex items-center space-x-2">
                  <span>⚠️ Stock Exceeded: You cannot sell more bags than what arrived on this truck dispatch. Please reduce the bag count.</span>
                </div>
              )}

              {getTruckColorInventory().length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {getTruckColorInventory().map((item) => {
                    const colorDef = bagColors.find((c) => c.name.toLowerCase() === item.colorName.toLowerCase());
                    const hex = colorDef?.color_code || '#2563eb';
                    return (
                      <div
                        key={item.colorName}
                        className={`p-2.5 bg-white rounded-lg border shadow-2xs space-y-1.5 transition-all ${
                          item.isOverSold
                            ? 'border-red-500 bg-red-50/60 ring-2 ring-red-400'
                            : 'border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center space-x-1.5 font-bold text-xs text-slate-900">
                            <span className="w-3 h-3 rounded-full border border-black/10 inline-block shadow-2xs" style={{ backgroundColor: hex }} />
                            <span>{item.colorName}</span>
                          </span>
                          <span className={`text-[10px] font-bold ${item.isOverSold ? 'text-red-700 font-extrabold' : 'text-slate-500'}`}>
                            Avail: <strong className={item.isOverSold ? 'text-red-800' : 'text-emerald-700'}>{item.available}</strong>
                          </span>
                        </div>
                        <div className="space-y-1">
                          <input
                            type="number"
                            min="0"
                            placeholder="Selling bags"
                            value={item.selling}
                            onChange={(e) => handleColorBagsChange(item.colorName, e.target.value)}
                            className={`w-full px-2 py-1 text-xs font-bold rounded focus:ring-1 ${
                              item.isOverSold
                                ? 'border-2 border-red-500 bg-white text-red-900 focus:ring-red-500'
                                : 'border border-slate-300 text-slate-900 focus:ring-blue-500'
                            }`}
                          />
                          {item.isOverSold && (
                            <span className="text-[10px] font-extrabold text-red-600 block leading-tight">
                              ❌ Cannot sell {item.selling}! Max is {item.available} bags (+{item.overSoldQty} over)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>Inward: {item.inward}</span>
                          <span className={`font-semibold ${item.isOverSold ? 'text-red-700 font-bold' : 'text-amber-800'}`}>
                            Remaining: {item.remaining}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-blue-700 italic">No specific color breakdown on this truck. You can type total bags below or click "+ Add Another Color".</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Bags *</label>
              <input
                type="number"
                required
                placeholder="e.g. 100"
                value={formData.bags}
                onChange={(e) => updateFinancialFields({ bags: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Qty (Qtls) *</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 30.00"
                value={formData.qty_qtls}
                onChange={(e) => updateFinancialFields({ qty_qtls: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Actual Rate (₹/Q)</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 6000"
                value={formData.actual_rate}
                onChange={(e) => updateFinancialFields({ actual_rate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
              {calcQtls > 0 && calcActualRate > 0 && (
                <div className="mt-1 p-1 bg-blue-50/90 border border-blue-200 rounded text-[10px] leading-tight text-blue-950 font-bold">
                  <span>Total: ₹{calcGrossActualAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="block text-[9px] text-blue-700 font-medium">Net (-LF): ₹{calcNetActualAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Billing Rate (₹/Q)</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 6100"
                value={formData.billing_rate}
                onChange={(e) => updateFinancialFields({ billing_rate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
              />
              {calcQtls > 0 && calcBillingRate > 0 && (
                <div className="mt-1 p-1 bg-emerald-50/90 border border-emerald-200 rounded text-[10px] leading-tight text-emerald-950 font-bold">
                  <span>Total: ₹{calcGrossBillingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="block text-[9px] text-emerald-700 font-medium">Net Bill: ₹{calcNetBillAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Brokerage (₹/Q)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 60 or 0"
                value={formData.brokerage_per_qtl}
                onChange={(e) => setFormData({ ...formData, brokerage_per_qtl: e.target.value })}
                className="w-full px-3 py-2 border border-purple-300 bg-purple-50/40 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold text-purple-950"
              />
              {calcQtls > 0 && calcBrokerageRate !== null && calcBrokerageRate > 0 && (
                <div className="mt-1 p-1 bg-purple-50/90 border border-purple-200 rounded text-[10px] leading-tight text-purple-950 font-bold">
                  <span>Total: ₹{calcTotalBrokerage.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details & Settlement Section */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>Wholesale Buyer Payment Realization & Settlement</span>
            </div>

            {/* Cash Discount (from Excel: Disc % and Discount Amount) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Disc % <span className="text-[10px] text-amber-800 font-semibold">(Cash Discount %)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 5"
                    value={formData.disc_pct}
                    onChange={(e) => updateFinancialFields({ disc_pct: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 pr-8"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Discount Amount (₹) <span className="text-[10px] text-slate-500 font-normal">(Auto-computed)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Auto from Disc %"
                  value={formData.discount_amount}
                  onChange={(e) => updateFinancialFields({ discount_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-amber-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Received Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 183000"
                  value={formData.received_amount}
                  onChange={(e) => updateFinancialFields({ received_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Received Date</label>
                <input
                  type="date"
                  value={formData.sale_received_date}
                  onChange={(e) => setFormData({ ...formData, sale_received_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Status</label>
                <select
                  value={formData.payment_status}
                  onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="PENDING PAYMENT">PENDING PAYMENT</option>
                  <option value="PAID">PAID</option>
                  <option value="CUTTING">CUTTING</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Mode</label>
                <select
                  value={formData.payment_mode}
                  onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="RTGS/NEFT">RTGS / NEFT</option>
                  <option value="Bank Transfer">Bank Transfer / IMPS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">UTR / Cheque / Ref No</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-92837482"
                  value={formData.payment_ref}
                  onChange={(e) => setFormData({ ...formData, payment_ref: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">Cutting / Shortage (₹)</label>
                  <button
                    type="button"
                    onClick={handleAutoCalculateCutting}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                    title="Calculate Cutting = Actual Amount - Received - Discount"
                  >
                    ⚡ Auto Calc
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 1428.5 or 0"
                  value={formData.cutting_amount}
                  onChange={(e) => setFormData({ ...formData, cutting_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Breakeven & Over-allocation Warning Strip */}
          {previewWarnings && (
            <div className={`p-3 rounded-xl border text-xs font-bold space-y-1 ${
              previewWarnings.toIntWarnings.length === 0 && !previewWarnings.belowBreakeven
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                : 'bg-amber-50/80 border-amber-300 text-amber-900'
            }`}>
              <div>Floor Breakeven on this Rate: <span className="font-black">₹{previewWarnings.breakevenRate.toLocaleString('en-IN')}</span> / Qtl
                {' '}{previewWarnings.belowBreakeven
                  ? <span className="text-rose-700 font-black">⚠ Billing rate ₹{Number(formData.billing_rate || 0).toLocaleString('en-IN')} is BELOW breakeven — you lose ₹{previewWarnings.lossPerQtl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/Qtl!</span>
                  : <span className="text-emerald-700 font-black">✓ Margin ₹{previewWarnings.marginPerQtl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/Qtl</span>}
              </div>
              {previewWarnings.toIntWarnings.map((w, i) => (
                <div key={i} className="text-[11px] text-amber-800">⚠ {w}</div>
              ))}
            </div>
          )}

          {/* Live Calculation Preview Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-200">
              <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Billing Rate Total (Invoice)</span>
                <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                  ₹{calcGrossBillingAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-700 mt-1">
                  Net after LF: <span className="font-bold">₹{calcNetBillAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">Actual Rate Total (Wholesale)</span>
                <div className="text-sm font-extrabold text-blue-950 mt-0.5">
                  ₹{calcGrossActualAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-blue-700 mt-1">
                  Actual Net after LF: <span className="font-bold">₹{calcNetActualAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Less: Lorry Freight Paid to Driver ({calcQtls} Qtls × ₹{calcLF}/Qtl):</span>
              <span className="font-semibold text-rose-700">-₹{calcLorryAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            {calcTotalBrokerage !== null && (
              <div className="flex items-center justify-between text-purple-900 text-[11px]">
                <span>Party Brokerage ({calcQtls} Qtls × ₹{calcBrokerageRate}/Qtl):</span>
                <span className="font-semibold text-purple-800">
                  -₹{calcTotalBrokerage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-emerald-950 font-black text-xs pt-1 border-t border-slate-200 bg-emerald-50/50 px-2 py-1 rounded">
              <span>Net Bill Amount Payable to Merchant:</span>
              <span className="text-emerald-800 text-sm">
                ₹{calcNetBillAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
              {editingSaleId ? 'Update Sales Bill' : 'Save Sales Bill'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
