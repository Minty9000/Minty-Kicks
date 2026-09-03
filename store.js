const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = IS_LOCAL ? 'http://localhost:3000' : '';
const FALLBACK_API_URL = IS_LOCAL ? '' : 'https://minty-kicks.onrender.com';
const INVENTORY_URL = `${API_URL}/data`;
const INVENTORY_CACHE = 'minty-kicks-inventory-v2';
const productList = document.getElementById('productList');
const sizeSelector = document.getElementById('sizeSelector');
const statusMessage = document.getElementById('statusMessage');
let products = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function productCard(product) {
  const isCard = product.itemType === 'card';
  const offerParams = new URLSearchParams({
    product: product.name,
    itemType: isCard ? 'card' : 'sneaker',
    price: Number(product.price).toFixed(2)
  });
  if (isCard) offerParams.set('details', product.details || 'Trading card');
  else offerParams.set('size', String(product.size));
  const itemLabel = isCard
    ? escapeHtml(product.details || 'Trading card')
    : `Men's ${Number(product.size).toFixed(Number(product.size) % 1 ? 1 : 0)}`;
  return `<article class="product-card">
    <div class="product-image-wrap"><img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy"></div>
    <div class="product-info">
      <span class="size-pill">${itemLabel}</span>
      <h3>${escapeHtml(product.name)}</h3>
      <div class="product-bottom"><strong>$${Number(product.price).toFixed(2)}</strong><a href="contact.html?${offerParams.toString()}#inquiry">Make an offer</a></div>
    </div>
  </article>`;
}

function renderProducts() {
  const filter = sizeSelector.value;
  const visible = filter === 'cards'
    ? products.filter((product) => product.itemType === 'card')
    : filter.startsWith('size:')
      ? products.filter((product) => product.itemType !== 'card' && Number(product.size) === Number(filter.slice(5)))
      : products;
  statusMessage.textContent = `${visible.length} ${visible.length === 1 ? 'item' : 'items'} available`;
  productList.innerHTML = visible.length
    ? visible.map(productCard).join('')
    : '<div class="empty-state"><h3>No matching items yet</h3><p>Try another filter or check back soon.</p></div>';
}

async function readCachedProducts() {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(INVENTORY_CACHE);
    const response = await cache.match(INVENTORY_URL);
    if (!response) return null;
    const cachedProducts = await response.json();
    return Array.isArray(cachedProducts) ? cachedProducts : null;
  } catch (_error) {
    return null;
  }
}

async function cacheProducts(response) {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(INVENTORY_CACHE);
    await cache.put(INVENTORY_URL, response);
  } catch (_error) {
    // Caching is an enhancement; inventory still works without it.
  }
}

async function fetchInventory() {
  try {
    const response = await fetch(INVENTORY_URL, { cache: 'no-cache' });
    if (response.ok || !FALLBACK_API_URL || response.status < 500) return response;
  } catch (error) {
    if (!FALLBACK_API_URL) throw error;
  }
  return fetch(`${FALLBACK_API_URL}/data`, { cache: 'no-cache' });
}

async function loadProducts() {
  const cachedProducts = await readCachedProducts();
  const hasCachedProducts = cachedProducts !== null;

  if (hasCachedProducts) {
    products = cachedProducts;
    renderProducts();
  } else {
    productList.innerHTML = '<div class="empty-state"><p>Loading the latest inventory…</p></div>';
  }

  try {
    const response = await fetchInventory();
    if (!response.ok) throw new Error('Inventory request failed');
    const responseForCache = response.clone();
    const freshProducts = await response.json();
    if (!hasCachedProducts || JSON.stringify(freshProducts) !== JSON.stringify(products)) {
      products = freshProducts;
      renderProducts();
    }
    await cacheProducts(responseForCache);
  } catch (_error) {
    if (hasCachedProducts) return;
    statusMessage.textContent = 'Inventory unavailable';
    productList.innerHTML = '<div class="empty-state"><h3>We could not load the collection</h3><p>Please refresh in a moment.</p></div>';
  }
}

sizeSelector.addEventListener('change', renderProducts);
document.getElementById('sizeNeeded').addEventListener('submit', (event) => event.preventDefault());
window.addEventListener('DOMContentLoaded', loadProducts);
