const express = require('express');
const pool = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.status, w.rating, w.created_at, m.id AS movie_id, m.title, m.genre, m.release_year
       FROM watchlist w
       JOIN movies m ON m.id = w.movie_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List watchlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { movie_id, status } = req.body;

  if (!movie_id) {
    return res.status(400).json({ error: 'movie_id is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO watchlist (user_id, movie_id, status)
       VALUES ($1, $2, COALESCE($3, 'planned'))
       ON CONFLICT (user_id, movie_id) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [req.userId, movie_id, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Movie not found' });
    }
    console.error('Add to watchlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, rating } = req.body;

  try {
    const result = await pool.query(
      `UPDATE watchlist SET
         status = COALESCE($1, status),
         rating = COALESCE($2, rating)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [status, rating, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update watchlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM watchlist WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist entry not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete watchlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
