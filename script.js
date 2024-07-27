document.getElementById('addProductButton').addEventListener('click', function() {
    const name = document.getElementById('productName').value;
    const size = document.getElementById('productSize').value;
    const price = document.getElementById('productPrice').value;
    const imageFile = document.getElementById('productImage').files[0];

    if (name && size && price && imageFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const imageUrl = event.target.result;

            const product = {
                name: name,
                size: size,
                price: parseFloat(price),
                imageUrl: imageUrl
            };

            addProductToServer(product);
        };
        reader.readAsDataURL(imageFile);
    } else {
        console.error('All fields are required.');
    }
});

function addProductCard(product, indexnum) {
    const productList = document.getElementById('productList');
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.innerHTML = `
        <h2>Size: ${product.size}</h2>
        <h3>${product.name}</h3>
        <img src="${product.imageUrl}" width="90%">
        <p>Price: $${product.price}</p>
        <button onclick="deleteProduct(${indexnum})">delete</button>`;
    productList.appendChild(productCard);
}

function addProductToServer(product) {
    fetch('https://final-test-7fvk.onrender.com/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(product)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(() => {
        clearInputFields();
        initializeProductList();
    })
    .catch(error => console.error('Error adding product:', error));
}

function initializeProductList() {
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
            addProductCard(product, index);
        });
    })
    .catch(error => console.error('Error fetching products:', error));
}

function deleteProduct(indexnum) {
    fetch(`https://final-test-7fvk.onrender.com/data/${indexnum}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(() => {
        initializeProductList();
    })
    .catch(error => console.error('Error deleting product:', error));
}

document.getElementById('deleteButton').addEventListener('click', function() {
    const num = document.getElementById('index').value;
    deleteProduct(num);
});

function closeModel() {
    const model = document.getElementById("passwordpage");
    model.style.display = "none";
    document.getElementById("error").textContent = "";
}

function checkPassword() {
    var correctPassword = "Gilbert@6737";
    const pass = document.getElementById("password").value;
    var errorMessage = document.getElementById("error");
    if (pass === correctPassword) {
        closeModel();
        clear();
    } else {
        errorMessage.textContent = "Incorrect password. Please try again.";
    }
}

function clearInputFields() {
    document.getElementById('productName').value = '';
    document.getElementById('productSize').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('index').value = '';
    document.getElementById('productList').innerHTML = '';
}

function clear() {
    document.getElementById("password").value = "";
}

function openBar() {
    const bar = document.getElementById('sidebar');
    bar.style.width = "300px";
    document.getElementById('half-circle').style.display = "none";
    document.getElementById('expand').style.display = "none";
    document.getElementById('close').style.display = "block";
    document.getElementById('close-circle').style.display = "block";
    document.getElementById('xmark').style.display = "block";
}

function closeBar() {
    const bar = document.getElementById('sidebar');
    bar.style.width = "0";
    document.getElementById('half-circle').style.display = "block";
    document.getElementById('expand').style.display = "block";
    document.getElementById('close').style.display = "none";
    document.getElementById('close-circle').style.display = "none";
    document.getElementById('xmark').style.display = "none";
}

window.addEventListener('load', initializeProductList);