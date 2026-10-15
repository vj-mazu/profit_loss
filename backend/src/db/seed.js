// ponytail: seed only essential admin/manager credentials and master settings. Zero dummy trucks/sales data.
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

export async function runSeeds() {
  console.log('Checking database seed state...');

  // 1. Seed Essential Users
  const userCheck = await query('SELECT COUNT(*) FROM users');
  if (parseInt(userCheck.rows[0].count, 10) === 0) {
    console.log('Seeding initial admin and manager users...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);

    await query(
      `INSERT INTO users (username, password_hash, full_name, role) VALUES
       ($1, $2, $3, $4),
       ($5, $6, $7, $8)`,
      [
        'admin', adminHash, 'System Administrator', 'admin',
        'manager', managerHash, 'Operations Manager', 'manager',
      ]
    );
    console.log('Default credentials created: admin/admin123 and manager/manager123');
  }

  // 2. Seed Master Settings
  const masterCheck = await query('SELECT COUNT(*) FROM masters');
  if (parseInt(masterCheck.rows[0].count, 10) === 0) {
    console.log('Seeding master settings...');
    const defaultSettings = {
      annual_interest_rate: 12.0,
      apmc_pct: 0.6,
      it_tcs_pct: 0.39,
      egb_cost_per_qtl: 100,
      egb_trpt_per_qtl: 20,
      delhi_brokerage_default: 60,
      kasat_brokerage_default: 40,
      cd_default: 300,
    };

    const locations = [
      { id: 1, name: 'Uttar Pradesh', code: 'UP', type: 'origin' },
      { id: 2, name: 'Madhya Pradesh', code: 'MP', type: 'origin' },
      { id: 3, name: 'Maharashtra', code: 'MH', type: 'destination', default_prefix: 'MH' },
      { id: 4, name: 'Gujarat', code: 'GJ', type: 'destination', default_prefix: 'GJ' },
      { id: 5, name: 'Karnataka', code: 'KA', type: 'destination', default_prefix: 'KA' },
    ];

    const parties = [];

    await query(
      `INSERT INTO masters (key, value) VALUES 
       ('system_settings', $1::jsonb),
       ('locations', $2::jsonb),
       ('parties', $3::jsonb)`,
      [JSON.stringify(defaultSettings), JSON.stringify(locations), JSON.stringify(parties)]
    );
  }

  console.log('Database clean configuration verified.');
}
