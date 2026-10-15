import React, { useState, useEffect } from 'react';
import { Settings, Users, MapPin, Building2, Plus, Save, Trash2, KeyRound, Package } from 'lucide-react';
import api from '../services/api';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

export default function MastersTab() {
  const { isAdmin, user: currentUser } = useAuth();
  const [subTab, setSubTab] = useState('settings'); // 'settings', 'colors', 'users', 'locations', 'parties'
  const [loading, setLoading] = useState(true);

  // System Settings state
  const [settings, setSettings] = useState({
    annual_interest_rate: 12.0,
    apmc_pct: 0.6,
    it_tcs_pct: 0.39,
    egb_cost_per_qtl: 100,
    egb_trpt_per_qtl: 20,
    delhi_brokerage_default: 60,
    kasat_brokerage_default: 40,
    cd_default: 300,
  });

  // Bag Colors / Brands state
  const [bagColors, setBagColors] = useState([
    { id: 'blue', name: 'Blue', color_code: '#2563eb' },
    { id: 'orange', name: 'Orange', color_code: '#ea580c' },
    { id: 'green', name: 'Green', color_code: '#16a34a' },
    { id: 'red', name: 'Red', color_code: '#dc2626' },
    { id: 'yellow', name: 'Yellow', color_code: '#ca8a04' },
    { id: 'white', name: 'White', color_code: '#64748b' },
  ]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#2563eb');

  // User Accounts state
  const [users, setUsers] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'manager',
  });

  // Locations state
  const [locations, setLocations] = useState([]);
  const [newLocName, setNewLocName] = useState('');
  const [newLocPrefix, setNewLocPrefix] = useState('');
  const [newLocType, setNewLocType] = useState('destination');

  // Parties state
  const [parties, setParties] = useState([]);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState('buyer');
  const [newPartyCity, setNewPartyCity] = useState('');
  const [newPartyBrokerage, setNewPartyBrokerage] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getMasters();
      if (res.data.system_settings) setSettings(res.data.system_settings);
      if (res.data.locations) {
        // Exclude hardcoded Maharashtra and Delhi locations
        setLocations(res.data.locations.filter(l => !['maharashtra', 'delhi'].includes(l.name?.toLowerCase().trim())));
      }
      if (res.data.bag_colors) setBagColors(res.data.bag_colors);

      if (isAdmin) {
        const usersRes = await api.getUsers();
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error('Failed to load masters', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.updateMasterSettings(settings);
      alert('System settings & interest rates saved successfully');
    } catch (err) {
      alert('Failed to save settings');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(userFormData);
      setIsUserModalOpen(false);
      setUserFormData({ username: '', password: '', full_name: '', role: 'manager' });
      const usersRes = await api.getUsers();
      setUsers(usersRes.data);
      alert('New user created successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Delete this user account?')) {
      try {
        await api.deleteUser(id);
        const usersRes = await api.getUsers();
        setUsers(usersRes.data);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete user');
      }
    }
  };

  const handleAddLocation = async () => {
    if (!newLocName.trim()) return;
    const updated = [
      ...locations,
      {
        id: Date.now(),
        name: newLocName.trim(),
        type: newLocType,
        default_prefix: newLocPrefix.trim().toUpperCase() || 'MH',
      },
    ];
    try {
      await api.updateLocations(updated);
      setLocations(updated);
      setNewLocName('');
      setNewLocPrefix('');
    } catch (err) {
      alert('Failed to update locations');
    }
  };

  const handleAddParty = async () => {
    if (!newPartyName.trim()) return;
    const updated = [
      ...parties,
      {
        id: Date.now(),
        name: newPartyName.trim(),
        type: newPartyType,
        city: newPartyCity.trim(),
        default_brokerage: newPartyBrokerage !== '' ? Number(newPartyBrokerage) : 0,
      },
    ];
    try {
      await api.updateParties(updated);
      setParties(updated);
      setNewPartyName('');
      setNewPartyCity('');
      setNewPartyBrokerage('');
    } catch (err) {
      alert('Failed to update parties directory');
    }
  };

  const handleDeleteParty = async (partyId) => {
    if (window.confirm('Delete this party from directory?')) {
      const updated = parties.filter((p) => p.id !== partyId);
      try {
        await api.updateParties(updated);
        setParties(updated);
      } catch (err) {
        alert('Failed to delete party');
      }
    }
  };

  const handleAddBagColor = async () => {
    if (!newColorName.trim()) return;
    const name = newColorName.trim();
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (bagColors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert('This bag color already exists!');
      return;
    }
    const updated = [
      ...bagColors,
      { id, name, color_code: newColorHex || '#2563eb' }
    ];
    try {
      await api.updateBagColors(updated);
      setBagColors(updated);
      setNewColorName('');
    } catch (err) {
      alert('Failed to save bag color');
    }
  };

  const handleDeleteBagColor = async (colorId) => {
    if (window.confirm('Delete this bag color?')) {
      const updated = bagColors.filter(c => c.id !== colorId);
      try {
        await api.updateBagColors(updated);
        setBagColors(updated);
      } catch (err) {
        alert('Failed to delete bag color');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Master Creation & System Control</h1>
        <p className="text-sm text-slate-500 font-medium">
          Configure float interest rates, APMC Mandi cess, broker commissions, location bill prefixes, and user accounts
        </p>
      </div>

      {/* Sub-tabs bar */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setSubTab('settings')}
          className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-bold text-sm transition-all ${
            subTab === 'settings'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Rates & Financial Parameters</span>
        </button>

        <button
          onClick={() => setSubTab('colors')}
          className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-bold text-sm transition-all ${
            subTab === 'colors'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Empty Bag Colors</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setSubTab('users')}
            className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-bold text-sm transition-all ${
              subTab === 'users'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts & Logins</span>
          </button>
        )}

        <button
          onClick={() => setSubTab('locations')}
          className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-bold text-sm transition-all ${
            subTab === 'locations'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Locations & Bill Prefixes</span>
        </button>
      </div>

      {/* Subtab 1: System Settings & Interest Rates */}
      {subTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Float Interest & Capital Cost Engine</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust the annual rate used to compute Interest Gained (early payer float) and Interest Loss (late payer penalty)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
            <div>
              <label className="block text-xs font-bold text-emerald-950 mb-1">
                Annual Interest Rate (% p.a.)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  required
                  value={settings.annual_interest_rate}
                  onChange={(e) => setSettings({ ...settings, annual_interest_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-emerald-300 rounded-lg font-bold table-number text-emerald-900 bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-emerald-700">% p.a.</span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">Default 12.0% calculated on 365 days base</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                APMC Mandi Tax (% on Billing)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settings.apmc_pct}
                  onChange={(e) => setSettings({ ...settings, apmc_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold table-number text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Standard 0.60%</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Income Tax / TCS (% on Billing)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  required
                  value={settings.it_tcs_pct}
                  onChange={(e) => setSettings({ ...settings, it_tcs_pct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold table-number text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Standard 0.39% (1.3% × 30%)</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Packaging & Brokerage Defaults</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">EGB Gunny Bags (₹/Qtl)</label>
                <input
                  type="number"
                  value={settings.egb_cost_per_qtl}
                  onChange={(e) => setSettings({ ...settings, egb_cost_per_qtl: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">EGB Transport (₹/Qtl)</label>
                <input
                  type="number"
                  value={settings.egb_trpt_per_qtl}
                  onChange={(e) => setSettings({ ...settings, egb_trpt_per_qtl: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Buyer Brokerage (₹/Qtl)</label>
                <input
                  type="number"
                  value={settings.delhi_brokerage_default}
                  onChange={(e) => setSettings({ ...settings, delhi_brokerage_default: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Seller Brokerage (₹/Qtl)</label>
                <input
                  type="number"
                  value={settings.kasat_brokerage_default}
                  onChange={(e) => setSettings({ ...settings, kasat_brokerage_default: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Subtab 2: User Accounts & Logins (Admin Only) */}
      {subTab === 'users' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Login Accounts</h2>
              <p className="text-xs text-slate-500 font-medium">Create and manage operational logins (Admin and Manager roles)</p>
            </div>
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Login</span>
            </button>
          </div>

          <table className="w-full text-left text-xs grid-table">
            <thead>
              <tr className="bg-[#2b6cb0] text-white font-bold text-[11px] uppercase tracking-wider border-b-2 border-blue-900">
                <th className="py-2.5 px-4 border-r border-blue-400/40">Username</th>
                <th className="py-2.5 px-4 border-r border-blue-400/40">Full Name</th>
                <th className="py-2.5 px-4 border-r border-blue-400/40">Role</th>
                <th className="py-2.5 px-4 border-r border-blue-400/40">Created Date</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="font-medium text-slate-700">
              {users.map((u, idx) => {
                const rowBg = idx % 4 < 2 ? 'bg-[#edfdf1] hover:bg-[#dcfce7]' : 'bg-[#f7f2fb] hover:bg-[#ede5f7]';
                return (
                  <tr key={u.id} className={`${rowBg} transition-colors`}>
                    <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-b border-slate-300">{u.username}</td>
                    <td className="py-2.5 px-4 text-slate-800 font-semibold border-r border-b border-slate-300">{u.full_name || '-'}</td>
                    <td className="py-2.5 px-4 border-r border-b border-slate-300">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        u.role === 'admin' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 border-r border-b border-slate-300">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center border-b border-slate-300">
                      {u.username !== currentUser?.username && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          title="Delete User"
                          className="border border-slate-300 bg-white hover:bg-rose-50 text-rose-600 p-1.5 rounded shadow-xs inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Subtab 3: Locations & Bill Prefixes */}
      {subTab === 'locations' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Dynamic Locations & Invoice Prefixes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add any origin state/city or destination market with custom invoice prefix (e.g. MH, GJ, KA)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Location name (e.g. Gujarat or Solapur)"
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="text"
              placeholder="Invoice Prefix (e.g. GJ)"
              value={newLocPrefix}
              onChange={(e) => setNewLocPrefix(e.target.value)}
              className="w-32 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase"
            />
            <select
              value={newLocType}
              onChange={(e) => setNewLocType(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
            >
              <option value="destination">Destination Market</option>
              <option value="origin">Origin / Source</option>
            </select>
            <button
              onClick={handleAddLocation}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
            >
              Add Location
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {locations.map((loc) => (
              <div key={loc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{loc.name}</div>
                  <div className="text-[11px] text-slate-500">
                    Prefix: <span className="font-bold text-emerald-800">{loc.default_prefix || loc.code}</span> • {loc.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab: Empty Bag Colors & Brands */}
      {subTab === 'colors' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Configurable Empty Gunny Bag Colors & Brands</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add any custom bag color (e.g. Blue, Orange, Green, Red, Yellow, White, Purple, Jute) for contract tracking
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <input
              type="text"
              placeholder="Bag Color / Brand Name (e.g. Red, Purple, Double Horse)"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600">Color Tag:</label>
              <input
                type="color"
                value={newColorHex}
                onChange={(e) => setNewColorHex(e.target.value)}
                className="w-9 h-8 p-0.5 border border-slate-300 rounded cursor-pointer"
              />
            </div>
            <button
              onClick={handleAddBagColor}
              className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              + Add Bag Color
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {bagColors.map((col) => (
              <div 
                key={col.id || col.name} 
                className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between transition-all hover:border-slate-300"
              >
                <div className="flex items-center space-x-2.5">
                  <span 
                    className="w-5 h-5 rounded-full border border-black/10 shadow-2xs inline-block"
                    style={{ backgroundColor: col.color_code || '#2563eb' }}
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900">{col.name}</span>
                    <span className="block text-[10px] text-slate-400 uppercase font-mono">{col.color_code}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBagColor(col.id)}
                  title={`Delete ${col.name}`}
                  className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create User Account */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Create User Login Account">
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Username</label>
            <input
              type="text"
              required
              placeholder="e.g. manager2"
              value={userFormData.username}
              onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Rajesh Kumar"
              value={userFormData.full_name}
              onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="Enter secure password"
              value={userFormData.password}
              onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Role</label>
            <select
              value={userFormData.role}
              onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
            >
              <option value="manager">Operations Manager (Daily entries, dispatches, sales bills)</option>
              <option value="admin">System Administrator (Full access + rates & user controls)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
