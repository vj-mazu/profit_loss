import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  TrendingUp, 
  Percent, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight,
  Package,
  Layers,
  Plus,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function DashboardTab({ 
  onSelectTruck, 
  onNavigateToOrders, 
  onNavigateToTrucks, 
  onNavigateToSales, 
  onNavigateToSettlement 
}) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await api.getDashboardMetrics();
        setMetrics(res.data);
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[45vh] space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-400">Loading live business metrics...</p>
      </div>
    );
  }

  const { trucks = {}, sales = {}, overdue_bills = [], recent_trucks = [] } = metrics || {};

  const totalTrucks = Number(trucks.total_trucks || 0);
  const inTransit = Number(trucks.in_transit || 0);
  const unloaded = Number(trucks.unloaded || 0);
  const settled = Number(trucks.settled || 0);

  const totalQtls = Number(trucks.total_qtls || 0);
  const totalBags = Number(trucks.total_bags || 0);
  const totalSales = Number(sales.total_gross_sales || 0);
  const pendingAmount = Number(sales.pending_amount || 0);
  const totalReceived = Number(sales.total_received || 0);
  const totalCutting = Number(sales.total_cutting || 0);
  const interestEarned = Number(sales.interest_earned || 0);
  const interestLoss = Number(sales.interest_loss || 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner Card (Amber/Orange solid style) */}
      <div className="bg-[#e07a00] text-white py-6 px-6 rounded-xl shadow-md text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Welcome back, {user?.username || 'admin'}!
        </h1>
      </div>

      {/* Subtitle */}
      <div className="text-center text-sm font-bold text-white -mt-2 mb-1">
        Profit-Loss Stock & Logistics Dashboard
      </div>

      {/* 4 Primary KPI Cards with Left Green Border */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Arrivals */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/70 border-l-[6px] border-l-[#059669] shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Consignment Arrivals</span>
          <div className="text-3xl font-bold text-slate-900 mt-2 table-number">{totalTrucks}</div>
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500 mt-2">
            <span className="text-blue-700 font-bold">{unloaded} Unloaded</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">{settled} Settled</span>
          </div>
        </div>

        {/* Card 2: Unloaded Stock Available for Sale */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/70 border-l-[6px] border-l-[#059669] shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Unloaded (In Godown)</span>
          <div className="text-3xl font-bold text-slate-900 mt-2 table-number">{unloaded}</div>
          <p className="text-[11px] text-emerald-700 mt-2 font-bold">
            Physically received & ready for sale
          </p>
        </div>

        {/* Card 3: Total Stock */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/70 border-l-[6px] border-l-[#059669] shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Stock (Qtls)</span>
          <div className="text-3xl font-bold text-slate-900 mt-2 table-number">
            {totalQtls.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            ≈ {totalBags.toLocaleString('en-IN')} Bags In Stock
          </p>
        </div>

        {/* Card 4: Outstanding Receivables */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/70 border-l-[6px] border-l-[#059669] shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Active Receivables</span>
          <div className="text-3xl font-bold text-slate-900 mt-2 table-number">
            ₹{(pendingAmount / 100000).toFixed(2)} <span className="text-base font-semibold text-slate-400">L</span>
          </div>
          <p className="text-[11px] text-rose-600 mt-2 font-medium">
            {sales.pending_count || 0} wholesale bills awaiting collection
          </p>
        </div>
      </div>

      {/* Quick Actions Container (Matching User Reference Image) */}
      <div className="bg-white rounded-xl shadow-xs p-6 border border-slate-200/70">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={onNavigateToOrders}
            className="bg-[#e07a00] hover:bg-[#c96c00] active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl shadow-xs text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>+ Create Purchase Order</span>
          </button>

          <button
            onClick={onNavigateToTrucks}
            className="bg-[#e07a00] hover:bg-[#c96c00] active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl shadow-xs text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>+ New Truck Dispatch</span>
          </button>

          <button
            onClick={onNavigateToSales}
            className="bg-[#e07a00] hover:bg-[#c96c00] active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl shadow-xs text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>+ Wholesale Sales Bill</span>
          </button>

          <button
            onClick={onNavigateToSettlement}
            className="bg-[#e07a00] hover:bg-[#c96c00] active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl shadow-xs text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            <span>+ Settle P&L Ledger</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row 2: Financial Yields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Float Interest Gained */}
        <div className="bg-linear-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Float Interest Gained</span>
            <Percent className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-2 table-number">
            +₹{interestEarned.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-700/90 mt-1 font-medium">
            Earnings from buyers paying before mill payment date (12% p.a.)
          </p>
        </div>

        {/* Interest Lost to Delays */}
        <div className="bg-linear-to-br from-amber-50 to-amber-100/40 border border-amber-200/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Delayed Capital Cost</span>
            <AlertTriangle className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-2 table-number">
            -₹{interestLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-amber-800/90 mt-1 font-medium">
            Financing penalty on delayed customer payments past due date
          </p>
        </div>

        {/* Cutting Deductions */}
        <div className="bg-linear-to-br from-rose-50 to-rose-100/40 border border-rose-200/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">Quality/Weight Cutting</span>
            <AlertTriangle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-2 table-number">
            -₹{totalCutting.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-rose-800/90 mt-1 font-medium">
            Deductions made by buyers for moisture/torn bag damage
          </p>
        </div>
      </div>

      {/* Two Column Section: Recent Activity & Overdue Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trucks */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <h2 className="text-sm font-bold text-slate-900">Recent Trucks Movement</h2>
            <span className="text-xs font-semibold text-slate-500">{recent_trucks.length} Recorded</span>
          </div>

          {recent_trucks.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Trucks Registered Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Get started by creating your first inward truck dispatch under the Inward Trucks tab.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent_trucks.map((t) => (
                <div 
                  key={t.id} 
                  onClick={() => onSelectTruck && onSelectTruck(t.id)}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-emerald-50/40 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">{t.truck_serial}</span>
                      <span className="text-xs font-semibold text-slate-500 table-number">({t.truck_number})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        t.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' :
                        t.status === 'UNLOADED' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">
                      {t.seller_name} • {t.bags} Bags ({t.qty_qtls} Qtls)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 table-number">
                      ₹{Number(t.purchase_amount).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end mt-0.5">
                      P&L Statement <ArrowUpRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-Risk Pending Invoices */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <h2 className="text-sm font-bold text-slate-900">Overdue Pending Invoices</h2>
            <span className="text-xs font-semibold text-rose-600">Action Required</span>
          </div>

          {overdue_bills.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">All Accounts Clear</h3>
              <p className="text-xs text-slate-500 mt-1">
                No overdue wholesale bills pending collection.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdue_bills.map((b) => (
                <div key={b.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-rose-50/30 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                        {b.sale_bill_no}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{b.party_name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">
                      {b.truck_serial} ({b.bags} Bags • {b.qty_qtls} Qtls)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-rose-600 table-number">
                      ₹{Number(b.bill_amount).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase mt-0.5 inline-block">
                      Pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
