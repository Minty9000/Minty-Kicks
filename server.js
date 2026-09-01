const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin not allowed'));
  }
}));
app.use(express.json({ limit: '3mb' }));

function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ message: 'Admin access is not configured.' });
  if (req.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Incorrect admin password.' });
  }
  next();
}

function validateProduct(body) {
  const name = String(body.name || '').trim();
  const size = Number(body.size);
  const price = Number(body.price);
  const imageUrl = String(body.imageUrl || '');
  if (!name || name.length > 120) return 'Enter a product name under 120 characters.';
  if (!Number.isFinite(size) || size < 1 || size > 30) return 'Enter a valid shoe size.';
  if (!Number.isFinite(price) || price < 0 || price > 100000) return 'Enter a valid price.';
  if (!imageUrl.startsWith('data:image/') || imageUrl.length > 2_800_000) return 'Choose an image under 2 MB.';
  return null;
}

async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    size NUMERIC(4,1) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

app.get('/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); } catch (error) { next(error); }
});

app.get('/data', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name, size::float, price::float, image_url AS "imageUrl", created_at AS "createdAt" FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/admin/verify', requireAdmin, (_req, res) => {
  res.status(204).end();
});

app.post('/data', requireAdmin, async (req, res, next) => {
  const validationError = validateProduct(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  try {
    const { name, size, price, imageUrl } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO products (name, size, price, image_url) VALUES ($1, $2, $3, $4) RETURNING id, name, size::float, price::float, image_url AS "imageUrl", created_at AS "createdAt"',
      [name.trim(), Number(size), Number(price), imageUrl]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.patch('/data/:id/price', requireAdmin, async (req, res, next) => {
  const price = Number(req.body.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    return res.status(400).json({ message: 'Enter a valid price.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE products SET price = $1 WHERE id = $2 RETURNING id, price::float',
      [price, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
    res.json(rows[0]);
  } catch (error) {
    if (error.code === '22P02') return res.status(400).json({ message: 'Invalid product ID.' });
    next(error);
  }
});

app.delete('/data/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found.' });
    res.status(204).end();
  } catch (error) {
    if (error.code === '22P02') return res.status(400).json({ message: 'Invalid product ID.' });
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`Minty Kicks API listening on port ${port}`)))
  .catch((error) => { console.error('Unable to initialize database:', error); process.exit(1); });
