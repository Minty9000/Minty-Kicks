// Function to add a product card to the DOM
function addProductCard(product) {
    const productList = document.getElementById('productList');
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.innerHTML = `
        <h2>Size: ${product.size}</h2>
        <h3>${product.name}</h3>
        <img src="${product.imageUrl}" width="90%" >
        <p>Price: $${product.price}</p>
    `;
    productList.appendChild(productCard);
}

// Retrieve products from the server and display them based on size
function initializeProductList(size) {
    fetch('https://final-test-7fvk.onrender.com/data')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(products => {
            document.getElementById('productList').innerHTML = '';
            products.forEach((product, index) => {
                if (product.size === size||size==0) {
                    addProductCard(product, index);
                }
            });
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
}

// Call initializeProductList on page load with the default size
window.addEventListener('load', function() {
    initializeProductList(document.getElementById('sizeSelector').value);
});

// Function to clear the product list
function clear() {
    const productList = document.getElementById('productList');
    productList.innerHTML = '';
}

// Event listener for the search button to filter products by size
document.getElementById('searchSize').addEventListener('click', function() {
    clear();
    initializeProductList(document.getElementById('sizeSelector').value);
});

// Prevent the default action for the sizeNeeded button
document.getElementById('sizeNeeded').addEventListener('click', function(event) {
    event.preventDefault();
});

// Function to open the sidebar
function openBar() {
    const bar = document.getElementById('sidebar');
    bar.style.width = "300px";
    document.getElementById('half-circle').style.display = "none";
    document.getElementById('expand').style.display = "none";
    document.getElementById('close').style.display = "block";
    document.getElementById('close-circle').style.display = "block";
    document.getElementById('xmark').style.display = "block";
}

// Function to close the sidebar
function closeBar() {
    const bar = document.getElementById('sidebar');
    bar.style.width = "0";
    document.getElementById('half-circle').style.display = "block";
    document.getElementById('expand').style.display = "block";
    document.getElementById('close').style.display = "none";
    document.getElementById('close-circle').style.display = "none";
    document.getElementById('xmark').style.display = "none";
}
