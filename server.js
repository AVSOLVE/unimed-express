const express = require('express');
const app = express();
const { magicWorks } = require('./core/executar'); // Import the function from script.js

app.get('/', async (req, res) => {
    try {
        await magicWorks();
        res.send(`Page title:`);
    } catch (error) {
        console.error('Error fetching page title:', error);
        res.status(500).send('An error occurred while fetching the page title.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
