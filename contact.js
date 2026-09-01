const params = new URLSearchParams(window.location.search);
const product = params.get('product');
const size = params.get('size');
const price = params.get('price');

if (product) {
  const selectedPair = document.getElementById('selectedPair');
  const subject = document.getElementById('subject');
  const message = document.getElementById('message');
  const details = [size ? `Men's size ${size}` : '', price ? `Listed at $${price}` : ''].filter(Boolean);

  document.getElementById('selectedProduct').textContent = product;
  document.getElementById('selectedDetails').textContent = details.join(' · ');
  subject.value = `Offer for ${product}${size ? ` — size ${size}` : ''}`;
  message.value = `Hi! I'm interested in the ${product}${size ? ` in men's size ${size}` : ''}${price ? `, listed at $${price}` : ''}. My offer is $`;
  selectedPair.hidden = false;
}
