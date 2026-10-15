import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw, 
  FileText, 
  Calendar, 
  Download,
  Printer,
  ChevronDown
} from 'lucide-react';

export default function FilterBar({
  search = '',
  setSearch,
  status = 'ALL',
  setStatus,
  statusOptions = [],
  startDate = '',
  setStartDate,
  endDate = '',
  setEndDate,
  month = 'ALL',
  setMonth,
  filterDate: filterDateProp = '',
  setFilterDate: setFilterDateProp,
  placeholder = 'SL No, WB No, Lorry, Bill, Miller, Party...',
  onSearch,
  onReset,
  onExportAllPdf,
  onExportWeekPdf,
  onExportDatePdf,
}) {
  const [activePreset, setActivePreset] = useState('ALL'); // 'ALL', 'DAILY', 'WEEKLY', 'MONTHLY'
  const [filterDate, setFilterDate] = useState(filterDateProp || startDate || '');

  // Sync internal filterDate with prop when it changes
  useEffect(() => {
    if (filterDateProp !== filterDate) {
      setFilterDate(filterDateProp);
    }
  }, [filterDateProp]);

  const handlePreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'DAILY') {
      if (setStartDate) setStartDate(todayStr);
      if (setEndDate) setEndDate(todayStr);
      if (setMonth) setMonth('ALL');
      if (onSearch) setTimeout(onSearch, 50);
    } else if (preset === 'WEEKLY') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      if (setStartDate) setStartDate(sevenDaysAgo);
      if (setEndDate) setEndDate(todayStr);
      if (setMonth) setMonth('ALL');
      if (onSearch) setTimeout(onSearch, 50);
    } else if (preset === 'MONTHLY') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const curMonth = String(now.getMonth() + 1).padStart(2, '0');
      if (setStartDate) setStartDate(firstDay);
      if (setEndDate) setEndDate(todayStr);
      if (setMonth) setMonth(curMonth);
      if (onSearch) setTimeout(onSearch, 50);
    } else {
      // ALL
      if (setStartDate) setStartDate('');
      if (setEndDate) setEndDate('');
      if (setMonth) setMonth('ALL');
      if (onReset) onReset();
    }
  };

  const months = [
    { value: 'ALL', label: 'All Months' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 space-y-3.5 mb-5">
      {/* Top Banner Ribbon with Daily, Weekly, Monthly Filters */}
      <div className="bg-[#fff9db] border border-[#f59e0b]/50 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-[#b45309] text-xs font-bold">
          <FileText className="w-4 h-4 text-[#d97706]" />
          <span>
            {activePreset === 'DAILY' && 'Daily Filter Active (Today\'s Records)'}
            {activePreset === 'WEEKLY' && 'Weekly Filter Active (Last 7 Days Records)'}
            {activePreset === 'MONTHLY' && 'Monthly Filter Active (Current Month Records)'}
            {activePreset === 'ALL' && 'Showing All Records (Custom Filter Range)'}
          </span>
        </div>

        {/* Daily, Weekly, Monthly Segmented Control */}
        <div className="flex items-center space-x-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handlePreset('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activePreset === 'ALL'
                ? 'bg-[#1e293b] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
            }`}
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => handlePreset('DAILY')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              activePreset === 'DAILY'
                ? 'bg-[#d97706] text-white shadow-xs'
                : 'bg-white hover:bg-amber-50 text-slate-700 border border-slate-300'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Daily</span>
          </button>
          <button
            type="button"
            onClick={() => handlePreset('WEEKLY')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activePreset === 'WEEKLY'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'bg-white hover:bg-emerald-50 text-slate-700 border border-slate-300'
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => handlePreset('MONTHLY')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activePreset === 'MONTHLY'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-300'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Filter Inputs Grid with Uppercase Labels (Exact match to user screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {/* MONTH */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth && setMonth(e.target.value)}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* FROM */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate && setStartDate(e.target.value)}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* TO */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate && setEndDate(e.target.value)}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* VIEW / STATUS */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Status / View
          </label>
          <select
            value={status}
            onChange={(e) => setStatus && setStatus(e.target.value)}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Records</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* SEARCH */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch && onSearch()}
            placeholder={placeholder}
            className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Action Buttons Row (Exact colors & layout from user screenshot) */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100">
        {/* Search Button (Orange) */}
        <button
          onClick={onSearch}
          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#e67e22] hover:bg-[#d35400] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>

        {/* Reset Button (Blue) */}
        <button
          onClick={onReset}
          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        {/* All PDF Button (Red) */}
        <button
          onClick={onExportAllPdf || (() => window.print())}
          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>All PDF</span>
        </button>

        {/* Week PDF / Excel (Teal) */}
        <button
          onClick={onExportWeekPdf || onExportAllPdf}
          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Week PDF</span>
        </button>

        {/* Specific Date Picker input & Date PDF */}
        <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate && setFilterDate(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-700"
          />
          <button
            onClick={() => onExportDatePdf && onExportDatePdf(filterDate)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#14b8a6] hover:bg-[#0d9488] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Date PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
