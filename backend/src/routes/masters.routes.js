// ponytail: clean master creation and system configuration routes
import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/masters (all masters data)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT key, value FROM masters');
    const masters = {};
    result.rows.forEach((row) => {
      masters[row.key] = row.value;
    });

    // Provide default fallback if empty
    if (!masters.system_settings) {
      masters.system_settings = {
        annual_interest_rate: 12.0,
        apmc_pct: 0.6,
        it_tcs_pct: 0.39,
        egb_cost_per_qtl: 100,
        egb_trpt_per_qtl: 20,
        delhi_brokerage_default: 60,
        kasat_brokerage_default: 40,
        cd_default: 300,
      };
    }

    // Provide default bag colors if empty
    if (!masters.bag_colors) {
      masters.bag_colors = [
        { id: 'blue', name: 'Blue', color_code: '#2563eb' },
        { id: 'orange', name: 'Orange', color_code: '#ea580c' },
        { id: 'green', name: 'Green', color_code: '#16a34a' },
        { id: 'red', name: 'Red', color_code: '#dc2626' },
        { id: 'yellow', name: 'Yellow', color_code: '#ca8a04' },
        { id: 'white', name: 'White', color_code: '#64748b' },
      ];
    }

    res.json(masters);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving master settings' });
  }
});

// PUT /api/masters/settings (Admin only: update interest, tax, brokerages)
router.put('/settings', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const newSettings = req.body;
    await query(
      `INSERT INTO masters (key, value, updated_at)
       VALUES ('system_settings', $1::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(newSettings)]
    );
    res.json({ message: 'System settings updated successfully', settings: newSettings });
  } catch (err) {
    res.status(500).json({ message: 'Error updating system settings' });
  }
});

// PUT /api/masters/locations (Admin only: update location list)
router.put('/locations', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const locations = req.body;
    await query(
      `INSERT INTO masters (key, value, updated_at)
       VALUES ('locations', $1::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(locations)]
    );
    res.json({ message: 'Locations updated successfully', locations });
  } catch (err) {
    res.status(500).json({ message: 'Error updating locations' });
  }
});

// PUT /api/masters/parties (Admin and Manager: manage party directory)
router.put('/parties', authenticate, async (req, res) => {
  try {
    const parties = req.body;
    await query(
      `INSERT INTO masters (key, value, updated_at)
       VALUES ('parties', $1::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(parties)]
    );
    res.json({ message: 'Parties directory updated successfully', parties });
  } catch (err) {
    res.status(500).json({ message: 'Error updating parties directory' });
  }
});

// PUT /api/masters/bag-colors (Admin and Manager: manage empty bag colors/brands)
router.put('/bag-colors', authenticate, async (req, res) => {
  try {
    const bagColors = req.body;
    await query(
      `INSERT INTO masters (key, value, updated_at)
       VALUES ('bag_colors', $1::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(bagColors)]
    );
    res.json({ message: 'Bag colors updated successfully', bag_colors: bagColors });
  } catch (err) {
    res.status(500).json({ message: 'Error updating bag colors' });
  }
});

export default router;
