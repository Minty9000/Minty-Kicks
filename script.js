const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = IS_LOCAL ? 'http://localhost:3000' : '';
const FALLBACK_API_URL = IS_LOCAL ? '' : 'https://minty-kicks.onrender.com';
const productList = document.getElementById('productList');
const form = document.getElementById('productForm');
const formStatus = document.getElementById('formStatus');
const productType = document.getElementById('productType');
const productSize = document.getElementById('productSize');
const productDetails = document.getElementById('productDetails');
let adminPassword = '';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function setStatus(message, type = '') {
  formStatus.textContent = message;
  formStatus.className = `form-status ${type}`;
}

function syncItemFields() {
  const isCard = productType.value === 'card';
  document.getElementById('sneakerFields').hidden = isCard;
  document.getElementById('cardFields').hidden = !isCard;
  productSize.disabled = isCard;
  productSize.required = !isCard;
  productDetails.disabled = !isCard;
  productDetails.required = isCard;
  document.getElementById('productName').placeholder = isCard ? '2024 Topps Chrome Victor Wembanyama' : 'Air Jordan 4 Retro';
}

function itemDescription(product) {
  return product.itemType === 'card' ? `Trading card · ${product.details || 'Details unavailable'}` : `Sneaker · Men's size ${product.size}`;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => { image.src = reader.result; };
    image.onerror = reject;
    image.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/webp', 0.78));
    };
    reader.readAsDataURL(file);
  });
}

async function fetchApi(path, options = {}) {
  const requestOptions = {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword, ...(options.headers || {}) }
  };
  try {
    const response = await fetch(`${API_URL}${path}`, requestOptions);
    if (response.ok || !FALLBACK_API_URL || response.status < 500) return response;
  } catch (error) {
    if (!FALLBACK_API_URL) throw error;
  }
  return fetch(`${FALLBACK_API_URL}${path}`, requestOptions);
}

async function apiRequest(path, options = {}) {
  const response = await fetchApi(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed.');
  }
  return response.status === 204 ? null : response.json();
}

async function loadProducts() {
  productList.innerHTML = '<p class="muted">Loading inventory…</p>';
  try {
    const response = await fetchApi('/data');
    if (!response.ok) throw new Error();
    const products = await response.json();
    productList.innerHTML = products.length ? products.map((product) => `
      <article class="admin-product">
        <img src="${product.imageUrl}" alt="">
        <div class="product-summary"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(itemDescription(product))}</span></div>
        <div class="price-editor">
          <label class="sr-only" for="price-${product.id}">Price for ${escapeHtml(product.name)}</label>
          <span>$</span>
          <input id="price-${product.id}" type="number" min="0" max="100000" step="0.01" value="${Number(product.price).toFixed(2)}" data-price-input="${product.id}">
          <button type="button" class="save-price-button" data-save-price="${product.id}">Save</button>
        </div>
        <button class="danger-button" data-delete="${product.id}" aria-label="Delete ${escapeHtml(product.name)}">Delete</button>
      </article>`).join('') : '<p class="muted">No inventory yet.</p>';
  } catch (_error) {
    productList.innerHTML = '<p class="error">Could not load inventory.</p>';
  }
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  adminPassword = document.getElementById('password').value;
  const loginButton = event.currentTarget.querySelector('button');
  loginButton.disabled = true;
  try {
    await apiRequest('/admin/verify', { method: 'POST' });
    document.getElementById('passwordpage').hidden = true;
    document.getElementById('adminContent').hidden = false;
    await loadProducts();
  } catch (error) {
    const oldError = event.currentTarget.querySelector('.login-error');
    if (oldError) oldError.remove();
    const message = document.createElement('p');
    message.className = 'login-error error';
    message.textContent = error.message;
    loginButton.before(message);
  } finally { loginButton.disabled = false; }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus('Optimizing image and saving…');
  try {
    const imageUrl = await compressImage(document.getElementById('productImage').files[0]);
    await apiRequest('/data', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('productName').value,
        itemType: productType.value,
        size: productType.value === 'sneaker' ? Number(productSize.value) : null,
        details: productType.value === 'card' ? productDetails.value.trim() : null,
        price: Number(document.getElementById('productPrice').value),
        imageUrl
      })
    });
    form.reset();
    syncItemFields();
    setStatus('Item saved permanently.', 'success');
    await loadProducts();
  } catch (error) {
    setStatus(error.message, 'error');
    if (error.message.includes('password')) document.getElementById('passwordpage').hidden = false;
  } finally { submitButton.disabled = false; }
});

productList.addEventListener('click', async (event) => {
  const saveButton = event.target.closest('[data-save-price]');
  if (saveButton) {
    const id = saveButton.dataset.savePrice;
    const input = productList.querySelector(`[data-price-input="${id}"]`);
    const price = Number(input.value);
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    try {
      const updated = await apiRequest(`/data/${id}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price })
      });
      input.value = Number(updated.price).toFixed(2);
      saveButton.textContent = 'Saved';
      setStatus('Price updated on the storefront.', 'success');
      setTimeout(() => { saveButton.textContent = 'Save'; }, 1400);
    } catch (error) {
      setStatus(error.message, 'error');
      saveButton.textContent = 'Save';
    } finally { saveButton.disabled = false; }
    return;
  }

  const button = event.target.closest('[data-delete]');
  if (!button || !confirm('Remove this product from the store?')) return;
  button.disabled = true;
  try { await apiRequest(`/data/${button.dataset.delete}`, { method: 'DELETE' }); await loadProducts(); }
  catch (error) { setStatus(error.message, 'error'); button.disabled = false; }
});

productType.addEventListener('change', syncItemFields);
syncItemFields();
