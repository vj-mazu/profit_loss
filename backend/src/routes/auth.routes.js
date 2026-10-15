// ponytail: clean auth routes with bcrypt & jwt
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'profit_loss_super_secret_erp_jwt_key_2026';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const userRes = await query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during authentication' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const userRes = await query('SELECT id, username, full_name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(userRes.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching user profile' });
  }
});

// GET /api/auth/users (Admin only)
router.get('/users', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await query('SELECT id, username, full_name, role, created_at FROM users ORDER BY id ASC');
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// POST /api/auth/users (Admin only: Create new user)
router.post('/users', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const validRoles = ['admin', 'manager'];
    const assignedRole = validRoles.includes(role) ? role : 'manager';

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, created_at`,
      [username.trim(), hash, full_name || username, assignedRole]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// PUT /api/auth/users/:id (Admin only: Update user / reset password)
router.put('/users/:id', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, password } = req.body;

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query(
        `UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role), password_hash = $3 WHERE id = $4`,
        [full_name, role, hash, id]
      );
    } else {
      await query(
        `UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role) WHERE id = $3`,
        [full_name, role, id]
      );
    }

    const updated = await query('SELECT id, username, full_name, role FROM users WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE /api/auth/users/:id (Admin only)
router.delete('/users/:id', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own admin account' });
    }
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;
