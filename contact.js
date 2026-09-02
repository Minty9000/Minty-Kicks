const params = new URLSearchParams(window.location.search);
const product = params.get('product');
const itemType = params.get('itemType');
const size = params.get('size');
const itemDetails = params.get('details');
const price = params.get('price');

if (product) {
  const selectedPair = document.getElementById('selectedPair');
  const subject = document.getElementById('subject');
  const message = document.getElementById('message');
  const itemDescription = itemType === 'card' ? (itemDetails || 'Trading card') : (size ? `Men's size ${size}` : '');
  const details = [itemDescription, price ? `Listed at $${price}` : ''].filter(Boolean);

  document.getElementById('selectedProduct').textContent = product;
  document.getElementById('selectedDetails').textContent = details.join(' · ');
  subject.value = `Offer for ${product}${itemDescription ? ` — ${itemDescription}` : ''}`;
  message.value = `Hi! I'm interested in the ${product}${itemDescription ? ` (${itemDescription})` : ''}${price ? `, listed at $${price}` : ''}. My offer is $`;
  selectedPair.hidden = false;
}
