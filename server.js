const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

// Initialize an empty array to store products
let products = [];

// Middleware setup
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Route to add a product
app.post('/data', (req, res) => {
    const product = req.body;
    products.push(product);
    res.status(201).json(product);
});

// Route to get all products
app.get('/data', (req, res) => {
    res.json(products);
});

// Route to delete a product by index
app.delete('/data/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    if (index >= 0 && index < products.length) {
        products.splice(index, 1);
        res.status(200).json({ message: 'Deleted successfully' });
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
