import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireGuest, requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Home page - PROTECTED (all users)
router.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

// About page - PROTECTED (all users)
router.get('/about', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/about.html'));
});

// Machines page - ADMIN ONLY
router.get('/machines', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/machines.html'));
});

// Settings page - PROTECTED (all users)
router.get('/settings', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});

// Contact page (GET) - PROTECTED
router.get('/contact', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/contact.html'));
});

// Login page
router.get('/login', requireGuest, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
});

// Register page
router.get('/register', requireGuest, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});


export default router;

