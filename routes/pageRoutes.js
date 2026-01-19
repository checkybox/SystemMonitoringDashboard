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

// Machines page
router.get('/machines', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/machines.html'));
});

// Settings page
router.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});

// Contact page (GET)
router.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/contact.html'));
});


export default router;

