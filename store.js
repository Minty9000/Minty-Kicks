const API_URL = 'https://minty-kicks.onrender.com';
const productList = document.getElementById('productList');
const sizeSelector = document.getElementById('sizeSelector');
const statusMessage = document.getElementById('statusMessage');
let products = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function productCard(product) {
  return `<article class="product-card">
    <div class="product-image-wrap"><img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy"></div>
    <div class="product-info">
      <span class="size-pill">Men's ${Number(product.size).toFixed(product.size % 1 ? 1 : 0)}</span>
      <h3>${escapeHtml(product.name)}</h3>
      <div class="product-bottom"><strong>$${Number(product.price).toFixed(2)}</strong><a href="contact.html">Make an offer</a></div>
    </div>
  </article>`;
}

function renderProducts() {
  const selectedSize = Number(sizeSelector.value);
  const visible = selectedSize ? products.filter((product) => Number(product.size) === selectedSize) : products;
  statusMessage.textContent = `${visible.length} ${visible.length === 1 ? 'pair' : 'pairs'} available`;
  productList.innerHTML = visible.length
    ? visible.map(productCard).join('')
    : '<div class="empty-state"><h3>No pairs in this size yet</h3><p>Try another size or check back soon.</p></div>';
}

async function loadProducts() {
  productList.innerHTML = '<div class="empty-state"><p>Loading the latest inventory…</p></div>';
  try {
    const response = await fetch(`${API_URL}/data`);
    if (!response.ok) throw new Error('Inventory request failed');
    products = await response.json();
    renderProducts();
  } catch (_error) {
    statusMessage.textContent = 'Inventory unavailable';
    productList.innerHTML = '<div class="empty-state"><h3>We could not load the collection</h3><p>Please refresh in a moment.</p></div>';
  }
}

sizeSelector.addEventListener('change', renderProducts);
document.getElementById('sizeNeeded').addEventListener('submit', (event) => event.preventDefault());
window.addEventListener('DOMContentLoaded', loadProducts);
