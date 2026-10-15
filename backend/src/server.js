// ponytail: lean Express server with auto-migration and auto-seed on startup
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

import { pool } from './config/db.js';
import { runMigrations } from './db/migrate.js';
import { runSeeds } from './db/seed.js';

import authRoutes from './routes/auth.routes.js';
import mastersRoutes from './routes/masters.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import trucksRoutes from './routes/trucks.routes.js';
import salesRoutes from './routes/sales.routes.js';
import settlementRoutes from './routes/settlement.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import exportRoutes from './routes/export.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/masters', mastersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/settlement', settlementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Start Server with auto-migration & auto-seeding
async function startServer() {
  try {
    // 1. Verify DB Connection
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL database successfully.');

    // 2. Run Migrations & Seeds automatically on server run
    await runMigrations();
    await runSeeds();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Profit-Loss ERP Backend running on port ${PORT}`);
      console.log(`🔗 API endpoint: http://localhost:${PORT}/api`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Fatal error starting backend server:', err);
    process.exit(1);
  }
}

startServer();
