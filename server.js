const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const inventoryCacheTtlMs = 60_000;
let inventoryCache = null;
let inventoryCacheExpiresAt = 0;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
const localPreviewOrigins = new Set(['http://127.0.0.1:4173', 'http://localhost:4173']);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || localPreviewOrigins.has(origin)) return callback(null, true);
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
  const itemType = String(body.itemType || 'sneaker');
  const size = body.size === null || body.size === '' || body.size === undefined ? null : Number(body.size);
  const details = String(body.details || '').trim();
  const price = Number(body.price);
  const imageUrl = String(body.imageUrl || '');
  if (!['sneaker', 'card'].includes(itemType)) return 'Select a valid item type.';
  if (!name || name.length > 120) return 'Enter an item name under 120 characters.';
  if (itemType === 'sneaker' && (!Number.isFinite(size) || size < 1 || size > 30)) return 'Enter a valid shoe size.';
  if (itemType === 'card' && (!details || details.length > 120)) return 'Enter card details under 120 characters.';
  if (!Number.isFinite(price) || price < 0 || price > 100000) return 'Enter a valid price.';
  if (!imageUrl.startsWith('data:image/') || imageUrl.length > 2_800_000) return 'Choose an image under 2 MB.';
  return null;
}

async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    item_type VARCHAR(20) NOT NULL DEFAULT 'sneaker',
    size NUMERIC(4,1),
    details VARCHAR(120),
    price NUMERIC(10,2) NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'sneaker';
  ALTER TABLE products ADD COLUMN IF NOT EXISTS details VARCHAR(120);
  ALTER TABLE products ALTER COLUMN size DROP NOT NULL;`);
}

app.get('/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); } catch (error) { next(error); }
});

app.get('/data', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400');
    if (inventoryCache && Date.now() < inventoryCacheExpiresAt) return res.json(inventoryCache);
    const { rows } = await pool.query('SELECT id, name, item_type AS "itemType", size::float, details, price::float, image_url AS "imageUrl", created_at AS "createdAt" FROM products ORDER BY created_at DESC');
    inventoryCache = rows;
    inventoryCacheExpiresAt = Date.now() + inventoryCacheTtlMs;
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
    const { name, price, imageUrl } = req.body;
    const itemType = String(req.body.itemType || 'sneaker');
    const size = itemType === 'sneaker' ? Number(req.body.size) : null;
    const details = itemType === 'card' ? String(req.body.details || '').trim() : null;
    const { rows } = await pool.query(
      'INSERT INTO products (name, item_type, size, details, price, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, item_type AS "itemType", size::float, details, price::float, image_url AS "imageUrl", created_at AS "createdAt"',
      [name.trim(), itemType, size, details, Number(price), imageUrl]
    );
    inventoryCache = null;
    inventoryCacheExpiresAt = 0;
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
    inventoryCache = null;
    inventoryCacheExpiresAt = 0;
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
    inventoryCache = null;
    inventoryCacheExpiresAt = 0;
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
