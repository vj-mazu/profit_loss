// ponytail: high-performance indexing architecture for 10M+ records
import { query } from '../config/db.js';

export async function runMigrations() {
  console.log('Running database migrations and high-performance indexing...');

  // 1. Core Tables
  await query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name VARCHAR(100),
      role VARCHAR(20) NOT NULL DEFAULT 'manager',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS masters (
      key VARCHAR(50) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      contract_no VARCHAR(50) UNIQUE NOT NULL,
      seller_name VARCHAR(150) NOT NULL,
      seller_address TEXT,
      gst_no VARCHAR(50),
      contract_date DATE NOT NULL,
      qty_qtls NUMERIC(12,2) NOT NULL,
      rate_per_qtl NUMERIC(12,2) NOT NULL,
      brand_colors JSONB,
      status VARCHAR(30) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS egb_stock (
      id SERIAL PRIMARY KEY,
      seller_name VARCHAR(150) UNIQUE NOT NULL,
      blue_bags INT DEFAULT 0,
      orange_bags INT DEFAULT 0,
      green_bags INT DEFAULT 0,
      total_bags INT DEFAULT 0,
      tons NUMERIC(10,2) DEFAULT 0,
      no_of_bundles INT DEFAULT 0,
      rc_tempo_bus NUMERIC(12,2) DEFAULT 0,
      lf_per_qtl NUMERIC(12,4) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trucks (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES purchase_orders(id) ON DELETE SET NULL,
      truck_serial VARCHAR(30) NOT NULL,
      truck_number VARCHAR(50) NOT NULL,
      date DATE NOT NULL,
      purchase_bill_no VARCHAR(50),
      seller_name VARCHAR(150) NOT NULL,
      bags INT NOT NULL,
      qty_qtls NUMERIC(12,2) NOT NULL,
      rate_per_qtl NUMERIC(12,2) NOT NULL,
      truck_lf NUMERIC(12,2) NOT NULL,
      purchase_amount NUMERIC(14,2) NOT NULL,
      lorry_advance NUMERIC(12,2) DEFAULT 0,
      brand VARCHAR(50),
      origin_location VARCHAR(100) DEFAULT 'Uttar Pradesh',
      dest_location VARCHAR(100) DEFAULT 'Maharashtra',
      unloading_date DATE,
      status VARCHAR(30) DEFAULT 'UNLOADED',
      remarks TEXT,
      purchase_payment_amount NUMERIC(14,2),
      purchase_payment_date DATE,
      sale_amount_received_date DATE,
      purchase_gap_days INT DEFAULT 0,
      purchase_delay_interest NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_bills (
      id SERIAL PRIMARY KEY,
      truck_id INT REFERENCES trucks(id) ON DELETE CASCADE,
      sale_bill_no VARCHAR(50) NOT NULL,
      party_name VARCHAR(150) NOT NULL,
      bags INT NOT NULL,
      qty_qtls NUMERIC(12,2) NOT NULL,
      actual_rate NUMERIC(12,2) NOT NULL,
      billing_rate NUMERIC(12,2) NOT NULL,
      bill_amount NUMERIC(14,2) NOT NULL,
      lorry_amount NUMERIC(12,2) DEFAULT 0,
      purchase_rate NUMERIC(12,2),
      lf_rate NUMERIC(12,2),
      apmc_rate NUMERIC(12,2),
      it_rate NUMERIC(12,2),
      egb_rate NUMERIC(12,2) DEFAULT 100,
      egb_trpt_rate NUMERIC(12,2) DEFAULT 20,
      delhi_brk_rate NUMERIC(12,2) DEFAULT 60,
      kasat_brk_rate NUMERIC(12,2) DEFAULT 40,
      cd_rate NUMERIC(12,2) DEFAULT 300,
      breakeven_rate NUMERIC(12,2),
      received_amount NUMERIC(14,2),
      disc_pct NUMERIC(5,4),
      discount_amount NUMERIC(12,2),
      cutting_amount NUMERIC(12,2) DEFAULT 0,
      sale_received_date DATE,
      interest_days INT DEFAULT 0,
      interest_amount NUMERIC(12,2) DEFAULT 0,
      interest_type VARCHAR(20) DEFAULT 'NONE',
      payment_status VARCHAR(30) DEFAULT 'PENDING PAYMENT',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS order_id INT REFERENCES purchase_orders(id) ON DELETE SET NULL;
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS kg_per_bag NUMERIC(6,2) DEFAULT 30;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS kg_per_bag NUMERIC(6,2) DEFAULT 30;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bags_given INT DEFAULT 0;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bags_given_blue INT DEFAULT 0;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bags_given_orange INT DEFAULT 0;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bags_given_green INT DEFAULT 0;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS bag_transport_cost NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS brokerage_per_qtl NUMERIC(12,2);
    ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS brokerage_amount NUMERIC(14,2);
    ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
    ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(100);
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS purchase_payment_mode VARCHAR(50);
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS purchase_payment_ref VARCHAR(100);
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS brand_breakdown JSONB;
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS lorry_advance NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS lf_balance NUMERIC(12,2);
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS egb_rate_per_qtl NUMERIC(12,2) DEFAULT 100;
    ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS brand_breakdown JSONB;
    ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS lorry_advance NUMERIC(12,2) DEFAULT 0;
     ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS buying_brokerage_per_qtl NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS broker_name VARCHAR(150);
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS buying_brokerage_per_qtl NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE trucks ADD COLUMN IF NOT EXISTS broker_name VARCHAR(150);
    ALTER TABLE trucks ALTER COLUMN brand TYPE VARCHAR(255);
    ALTER TABLE trucks ALTER COLUMN status SET DEFAULT 'UNLOADED';
    UPDATE trucks SET status = 'UNLOADED', unloading_date = COALESCE(unloading_date, date) WHERE status = 'IN_TRANSIT';
  `);

  // 2. High-Scale 10M Performance Indexes (B-Tree + Composite + GIN Trigram)
  await query(`
    -- Trucks: Primary Cursor & Composite Filter Indexes
    CREATE INDEX IF NOT EXISTS idx_trucks_cursor_id_desc ON trucks(id DESC);
    CREATE INDEX IF NOT EXISTS idx_trucks_status_cursor ON trucks(status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_trucks_date_cursor ON trucks(date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_trucks_seller_cursor ON trucks(seller_name, id DESC);
    CREATE INDEX IF NOT EXISTS idx_trucks_brand_cursor ON trucks(brand, id DESC);

    -- Trucks: Instant Partial Indexes for Dashboard KPIs
    CREATE INDEX IF NOT EXISTS idx_trucks_in_transit ON trucks(id) WHERE status = 'IN_TRANSIT';
    CREATE INDEX IF NOT EXISTS idx_trucks_unloaded ON trucks(id) WHERE status = 'UNLOADED';
    CREATE INDEX IF NOT EXISTS idx_trucks_settled ON trucks(id) WHERE status = 'SETTLED';

    -- Trucks: Trigram GIN Search Index (Sub-millisecond text search across millions of rows)
    CREATE INDEX IF NOT EXISTS idx_trucks_search_trgm ON trucks USING gin (
      (truck_serial || ' ' || truck_number || ' ' || COALESCE(purchase_bill_no, '') || ' ' || seller_name) gin_trgm_ops
    );

    -- Sales Bills: Primary Cursor & Composite Filter Indexes
    CREATE INDEX IF NOT EXISTS idx_sales_cursor_id_desc ON sales_bills(id DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_truck_cursor ON sales_bills(truck_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_status_cursor ON sales_bills(payment_status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_party_cursor ON sales_bills(party_name, id DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_received_date_cursor ON sales_bills(sale_received_date DESC, id DESC);

    -- Sales Bills: Instant Partial Indexes for Outstanding & Cuts
    CREATE INDEX IF NOT EXISTS idx_sales_pending ON sales_bills(id, bill_amount) WHERE payment_status = 'PENDING PAYMENT';
    CREATE INDEX IF NOT EXISTS idx_sales_paid ON sales_bills(id, received_amount) WHERE payment_status = 'PAID';
    CREATE INDEX IF NOT EXISTS idx_sales_cutting ON sales_bills(id, cutting_amount) WHERE payment_status = 'CUTTING';

    -- Sales Bills: Trigram GIN Search Index
    CREATE INDEX IF NOT EXISTS idx_sales_search_trgm ON sales_bills USING gin (
      (sale_bill_no || ' ' || party_name) gin_trgm_ops
    );
    -- Purchase Orders (Contracts): High-Speed Indexes
    CREATE INDEX IF NOT EXISTS idx_po_contract_no ON purchase_orders(contract_no);
    CREATE INDEX IF NOT EXISTS idx_po_seller_name ON purchase_orders(seller_name);
    CREATE INDEX IF NOT EXISTS idx_po_date_cursor ON purchase_orders(contract_date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_po_search_trgm ON purchase_orders USING gin (
      (contract_no || ' ' || seller_name) gin_trgm_ops
    );

    -- Foreign Key Indexes for Instant Joins
    CREATE INDEX IF NOT EXISTS idx_trucks_order_id ON trucks(order_id);
    CREATE INDEX IF NOT EXISTS idx_sales_bills_truck_id ON sales_bills(truck_id);

    -- Empty Gunny Bags (EGB Stock)
    CREATE INDEX IF NOT EXISTS idx_egb_seller ON egb_stock(seller_name);

    -- Date and Accounting Optimization
    CREATE INDEX IF NOT EXISTS idx_trucks_unloading_date ON trucks(unloading_date DESC);
    CREATE INDEX IF NOT EXISTS idx_trucks_purchase_payment_date ON trucks(purchase_payment_date);
    CREATE INDEX IF NOT EXISTS idx_trucks_sale_received_date ON trucks(sale_amount_received_date);
  `);

  console.log('High-performance 10M indexes created successfully across all tables.');
}
