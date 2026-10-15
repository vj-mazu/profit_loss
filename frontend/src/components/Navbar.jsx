import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileSpreadsheet, 
  LogOut, 
  ShieldCheck, 
  UserCheck,
  Wheat,
  Factory
} from 'lucide-react';
import api from '../services/api';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'orders', label: '1. Orders & Bags' },
    { id: 'trucks', label: '2. Inward Trucks' },
    { id: 'sales', label: '3. Wholesale Sales' },
    { id: 'settlement', label: '4. Payments & P&L' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'expenditures', label: 'Expenditures' },
    { id: 'masters', label: 'Master Settings' },
  ];

  const handleDownloadExcel = () => {
    const token = localStorage.getItem('token');
    window.open(`${api.downloadExcelUrl}?token=${token}`, '_blank');
  };

  return (
    <header className="bg-[#0f6c44] text-white sticky top-0 z-40 shadow-md border-b border-emerald-900/40">
      <div className="w-full px-3 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-amber-300">
                <Wheat className="w-5 h-5 text-amber-300" />
              </div>
              <span className="text-lg font-black tracking-tight text-white uppercase">Profit Loss Software</span>
            </div>

            {/* Navigation Tabs (Pill Style from user image) */}
            <nav className="hidden md:flex items-center space-x-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#189a66] text-white shadow-xs'
                        : 'text-emerald-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Action Icons & User Badge */}
          <div className="flex items-center space-x-3">
            {/* Formatted Excel Download Button */}
            <button
              onClick={handleDownloadExcel}
              title="Download pre-formatted, styled Excel"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            {/* User Profile Badge & Logout */}
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
                {isAdmin ? 'Admin' : 'Manager'} {user?.username}
              </span>
              <button
                onClick={logout}
                title="Logout"
                className="px-3 py-1 rounded-md text-xs font-bold bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-xs transition-colors flex items-center space-x-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto py-2 border-t border-emerald-600/50 space-x-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${
                  isActive ? 'bg-[#189a66] text-white' : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
