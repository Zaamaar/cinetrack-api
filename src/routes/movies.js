const express = require('express');
const pool = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM movies ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('List movies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const { title, genre, release_year } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO movies (title, genre, release_year, added_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, genre || null, release_year || null, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add movie error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
