// ponytail: lean axios API client with automatic JWT token attachment
import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_URL || '/api';
const baseURL = rawBaseURL.endsWith('/api') ? rawBaseURL : `${rawBaseURL.replace(/\/+$/, '')}/api`;

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? baseURL : '/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth & User Management
  login: (credentials) => API.post('/auth/login', credentials),
  getMe: () => API.get('/auth/me'),
  getUsers: () => API.get('/auth/users'),
  createUser: (userData) => API.post('/auth/users', userData),
  updateUser: (id, userData) => API.put(`/auth/users/${id}`, userData),
  deleteUser: (id) => API.delete(`/auth/users/${id}`),

  // Dashboard
  getDashboardMetrics: () => API.get('/dashboard/metrics'),

  // Trucks Logistics
  getTrucks: (params) => API.get('/trucks', { params }),
  getTruckById: (id) => API.get(`/trucks/${id}`),
  createTruck: (truckData) => API.post('/trucks', truckData),
  updateTruck: (id, truckData) => API.put(`/trucks/${id}`, truckData),
  deleteTruck: (id) => API.delete(`/trucks/${id}`),

  // Sales Bills
  getSales: (params) => API.get('/sales', { params }),
  createSale: (saleData) => API.post('/sales', saleData),
  updateSale: (id, saleData) => API.put(`/sales/${id}`, saleData),
  deleteSale: (id) => API.delete(`/sales/${id}`),

  // Settlement & Profit-Loss Ledger
  getTruckSettlement: (id) => API.get(`/settlement/truck/${id}`),
  getSettlementSummary: () => API.get('/settlement/summary'),
  updateTruckPayment: (id, paymentData) => API.put(`/settlement/truck/${id}/payment`, paymentData),

  // Orders & EGB Packaging
  getOrders: () => API.get('/orders'),
  getNextContractNo: () => API.get('/orders/next-contract-no'),
  getOrderTrucks: (id) => API.get(`/orders/${id}/trucks`),
  createOrder: (orderData) => API.post('/orders', orderData),
  updateOrder: (id, orderData) => API.put(`/orders/${id}`, orderData),
  deleteOrder: (id) => API.delete(`/orders/${id}`),
  updateEgbStock: (id, egbData) => API.put(`/orders/egb/${id}`, egbData),

  // Masters & System Configuration
  getMasters: () => API.get('/masters'),
  updateMasterSettings: (settings) => API.put('/masters/settings', settings),
  updateLocations: (locations) => API.put('/masters/locations', locations),
  updateParties: (parties) => API.put('/masters/parties', parties),
  updateBagColors: (bagColors) => API.put('/masters/bag-colors', bagColors),

  // Pre-Formatted Excel Download
  downloadExcelUrl: '/api/export/excel',
};

export default api;
