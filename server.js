const express = require('express');
const app = express();
const { getPageTitle } = require('./script'); // Import the function from script.js

app.get('/', async (req, res) => {
    try {
        const url = req.query.url || 'https://example.com'; // Allow URL to be passed as a query parameter
        const title = await getPageTitle(url);
        res.send(`Page title: ${title}`);
    } catch (error) {
        console.error('Error fetching page title:', error);
        res.status(500).send('An error occurred while fetching the page title.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
