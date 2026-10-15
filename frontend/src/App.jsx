import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import DashboardTab from './components/DashboardTab';
import TrucksTab from './components/TrucksTab';
import SalesTab from './components/SalesTab';
import SettlementTab from './components/SettlementTab';
import OrdersTab from './components/OrdersTab';
import StocksTab from './components/StocksTab';
import ExpendituresTab from './components/ExpendituresTab';
import MastersTab from './components/MastersTab';
import Login from './components/Login';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTruckId, setSelectedTruckId] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleSelectTruckForSales = (truckId) => {
    setSelectedTruckId(truckId);
    setActiveTab('sales');
  };

  const handleSelectTruckForSettlement = (truckId) => {
    setSelectedTruckId(truckId);
    setActiveTab('settlement');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-100 to-amber-100 flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full px-3 sm:px-6 py-5">
        <div key={activeTab} className="tab-fade">
        {activeTab === 'dashboard' && (
          <DashboardTab
            onSelectTruck={handleSelectTruckForSettlement}
            onNavigateToOrders={() => setActiveTab('orders')}
            onNavigateToTrucks={() => setActiveTab('trucks')}
            onNavigateToSales={() => setActiveTab('sales')}
            onNavigateToSettlement={() => setActiveTab('settlement')}
          />
        )}
        {activeTab === 'trucks' && (
          <TrucksTab
            onSelectTruckForSales={handleSelectTruckForSales}
            onSelectTruckForSettlement={handleSelectTruckForSettlement}
          />
        )}
        {activeTab === 'sales' && (
          <SalesTab selectedTruckId={selectedTruckId} />
        )}
        {activeTab === 'settlement' && (
          <SettlementTab selectedTruckId={selectedTruckId} />
        )}
        {activeTab === 'orders' && (
          <OrdersTab />
        )}
        {activeTab === 'stocks' && (
          <StocksTab />
        )}
        {activeTab === 'expenditures' && (
          <ExpendituresTab />
        )}
        {activeTab === 'masters' && (
          <MastersTab />
        )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
