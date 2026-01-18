import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Home page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

// About page
router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/about.html'));
});

// Settings page
router.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});

// Contact page (GET)
router.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/contact.html'));
});

// Search page with query parameter
router.get('/search', (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).send('<h2>Error: Search query parameter "q" is required.</h2><p>Example: /search?q=cpu</p>');
    }

    res.sendFile(path.join(__dirname, '../views/search.html'));
});

// Item detail page with route parameter
router.get('/item/:id', (req, res) => {
    const itemId = req.params.id;

    if (!itemId) {
        return res.status(400).send('<h2>Error: Item ID is required.</h2>');
    }

    res.sendFile(path.join(__dirname, '../views/item.html'));
});

export default router;

