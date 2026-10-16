import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

/**
 * Senior Enterprise Rice Mill & Logistics Brand Mark
 * Combines golden paddy/rice grain stalks framing a modern industrial rice mill & grain silo.
 */
function RiceMillLogo({ className = "w-16 h-16" }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crestGrad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#064e3b" />
          <stop offset="0.6" stopColor="#043828" />
          <stop offset="1" stopColor="#022c22" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.4" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="millSteel" x1="0" y1="0" x2="0" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
        <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Rounded Crest Container */}
      <rect width="72" height="72" rx="20" fill="url(#crestGrad)" />
      <rect x="1" y="1" width="70" height="70" rx="19" stroke="#10b981" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="3.5" y="3.5" width="65" height="65" rx="16.5" stroke="url(#goldGrad)" strokeOpacity="0.2" strokeWidth="1" />

      {/* Center Emblem Group */}
      <g filter="url(#subtleGlow)" transform="translate(15, 12)">
        {/* Modern Rice Mill Silo & Factory Building */}
        <path d="M12 28V15L21 9L30 15V28H12Z" fill="url(#millSteel)" />
        {/* Silo Top Elevator Tower */}
        <path d="M18 9V4C18 3.44772 18.4477 3 19 3H23C23.5523 3 24 3.44772 24 4V9" stroke="url(#goldGrad)" strokeWidth="2" strokeLinecap="round" />
        {/* Silo Inspection Windows */}
        <rect x="18" y="14" width="6" height="5" rx="1" fill="#064e3b" />
        <rect x="14" y="22" width="4" height="4" rx="0.5" fill="#064e3b" />
        <rect x="24" y="22" width="4" height="4" rx="0.5" fill="#064e3b" />

        {/* Left Golden Paddy Grain Ear */}
        <path d="M9 36C9 36 6 29 11 23C15 18 19 21 17 26C15 31 10 34 9 36Z" fill="url(#goldGrad)" />
        <path d="M6 29C6 29 2 24 5 19C8 15 12 17 10 22C8 26 6 29 6 29Z" fill="url(#goldGrad)" />
        <path d="M10 21C10 21 7 16 10 12C13 9 17 11 15 15C13 19 10 21 10 21Z" fill="url(#goldGrad)" />

        {/* Right Golden Paddy Grain Ear */}
        <path d="M33 36C33 36 36 29 31 23C27 18 23 21 25 26C27 31 32 34 33 36Z" fill="url(#goldGrad)" />
        <path d="M36 29C36 29 40 24 37 19C34 15 30 17 32 22C34 26 36 29 36 29Z" fill="url(#goldGrad)" />
        <path d="M32 21C32 21 35 16 32 12C29 9 25 11 27 15C29 19 32 21 32 21Z" fill="url(#goldGrad)" />

        {/* Ground / Weighbridge Foundation Platform */}
        <rect x="4" y="36" width="34" height="3" rx="1.5" fill="url(#goldGrad)" />
      </g>
    </svg>
  );
}

import { useToast } from '../context/ToastContext';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      toast.success(`Welcome back, ${username}!`, 'Login Successful');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid username or password';
      setError(msg);
      toast.error(msg, 'Login Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-[#090d16] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))] flex items-center justify-center p-4 relative">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[340px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-[420px] w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 z-10">
        {/* Top Clean Corporate Header with ONE Brand Icon */}
        <div className="bg-[#064e3b] text-white pt-8 pb-7 px-8 text-center relative border-b border-emerald-900/60">
          {/* Version / System Badge */}
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 mb-4 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Enterprise ERP • Commodity Trading</span>
          </div>

          {/* THE SINGLE RICE MILL EMBLEM ICON */}
          <div className="flex justify-center mb-3.5">
            <RiceMillLogo className="w-16 h-16 drop-shadow-lg" />
          </div>

          <h1 className="text-xl font-black tracking-tight text-white uppercase">
            Profit Loss Software
          </h1>
          <p className="text-emerald-100/80 text-xs mt-1 font-medium">
            Rice Mill Procurement, Logistics & P&L Settlement
          </p>
        </div>

        {/* Login Form */}
        <div className="p-7">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none transition-all font-semibold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:bg-white focus:outline-none transition-all font-semibold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#064e3b] hover:bg-[#043828] active:scale-[0.99] text-white font-bold rounded-lg shadow-md flex items-center justify-center space-x-2 transition-all mt-3 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to ERP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Senior Developer Clean Demo Credentials Strip */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              Demo Access Credentials:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 space-x-1 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'admin123')}
                className="px-3 py-1 rounded-md font-semibold text-slate-700 hover:text-emerald-900 hover:bg-white transition-all cursor-pointer"
              >
                Admin <span className="text-slate-400 font-normal font-mono text-[10px]">(admin/admin123)</span>
              </button>
              <span className="text-slate-300 self-center">|</span>
              <button
                type="button"
                onClick={() => handleQuickFill('manager', 'manager123')}
                className="px-3 py-1 rounded-md font-semibold text-slate-700 hover:text-emerald-900 hover:bg-white transition-all cursor-pointer"
              >
                Manager <span className="text-slate-400 font-normal font-mono text-[10px]">(manager/manager123)</span>
              </button>
            </div>
          </div>

          {/* Secure Audit Footnote */}
          <div className="mt-5 flex items-center justify-center space-x-1.5 text-[10px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted Session • Audited Commodity Accounting Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
