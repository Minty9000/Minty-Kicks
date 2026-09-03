const { Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000
    })
  : null;

if (pool) attachDatabasePool(pool);

let inventoryCache = null;
let inventoryCacheExpiresAt = 0;
const inventoryCacheTtlMs = 60_000;

function requireDatabase(response) {
  if (pool) return true;
  response.status(503).json({ message: 'Database access is not configured.' });
  return false;
}

function requireAdmin(request, response) {
  if (!process.env.ADMIN_PASSWORD) {
    response.status(503).json({ message: 'Admin access is not configured.' });
    return false;
  }
  if (request.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    response.status(401).json({ message: 'Incorrect admin password.' });
    return false;
  }
  return true;
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

function clearInventoryCache() {
  inventoryCache = null;
  inventoryCacheExpiresAt = 0;
}

function methodNotAllowed(response, allowedMethods) {
  response.setHeader('Allow', allowedMethods.join(', '));
  return response.status(405).json({ message: 'Method not allowed.' });
}

async function handleInventory(request, response) {
  if (request.method === 'GET') {
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400');
    if (inventoryCache && Date.now() < inventoryCacheExpiresAt) return response.status(200).json(inventoryCache);
    const { rows } = await pool.query(
      'SELECT id, name, item_type AS "itemType", size::float, details, price::float, image_url AS "imageUrl", created_at AS "createdAt" FROM products ORDER BY created_at DESC'
    );
    inventoryCache = rows;
    inventoryCacheExpiresAt = Date.now() + inventoryCacheTtlMs;
    return response.status(200).json(rows);
  }

  if (request.method === 'POST') {
    if (!requireAdmin(request, response)) return;
    const body = request.body || {};
    const validationError = validateProduct(body);
    if (validationError) return response.status(400).json({ message: validationError });
    const itemType = String(body.itemType || 'sneaker');
    const size = itemType === 'sneaker' ? Number(body.size) : null;
    const details = itemType === 'card' ? String(body.details || '').trim() : null;
    const { rows } = await pool.query(
      'INSERT INTO products (name, item_type, size, details, price, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, item_type AS "itemType", size::float, details, price::float, image_url AS "imageUrl", created_at AS "createdAt"',
      [String(body.name).trim(), itemType, size, details, Number(body.price), String(body.imageUrl)]
    );
    clearInventoryCache();
    return response.status(201).json(rows[0]);
  }

  return methodNotAllowed(response, ['GET', 'POST']);
}

async function handlePrice(request, response) {
  if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH']);
  if (!requireAdmin(request, response)) return;
  const price = Number((request.body || {}).price);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    return response.status(400).json({ message: 'Enter a valid price.' });
  }
  const { rows } = await pool.query(
    'UPDATE products SET price = $1 WHERE id = $2 RETURNING id, price::float',
    [price, request.query.id]
  );
  if (rows.length === 0) return response.status(404).json({ message: 'Product not found.' });
  clearInventoryCache();
  return response.status(200).json(rows[0]);
}

async function handleItem(request, response) {
  if (request.method !== 'DELETE') return methodNotAllowed(response, ['DELETE']);
  if (!requireAdmin(request, response)) return;
  const result = await pool.query('DELETE FROM products WHERE id = $1', [request.query.id]);
  if (result.rowCount === 0) return response.status(404).json({ message: 'Product not found.' });
  clearInventoryCache();
  return response.status(204).end();
}

module.exports = async function handler(request, response) {
  if (!requireDatabase(response)) return;
  const action = String(request.query.action || '');

  try {
    if (action === 'data') return await handleInventory(request, response);
    if (action === 'price') return await handlePrice(request, response);
    if (action === 'item') return await handleItem(request, response);
    if (action === 'verify') {
      if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
      if (!requireAdmin(request, response)) return;
      return response.status(204).end();
    }
    if (action === 'health') {
      if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);
      await pool.query('SELECT 1');
      return response.status(200).json({ status: 'ok' });
    }
    return response.status(404).json({ message: 'API route not found.' });
  } catch (error) {
    if (error.code === '22P02') return response.status(400).json({ message: 'Invalid product ID.' });
    console.error(error);
    return response.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
