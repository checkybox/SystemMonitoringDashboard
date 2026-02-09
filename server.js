import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MongoStore from 'connect-mongo';

// Import routers
import pageRoutes from './routes/pageRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import authRoutes from './routes/authRoutes.js';

// Import middleware
import { addUserToLocals } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

// Trust proxy - CRITICAL for Render (behind reverse proxy)
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URL,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 1 day in seconds
    }),
    cookie: {
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
        maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
        sameSite: 'lax' // CSRF protection
    },
    name: 'sessionId' // Custom cookie name (don't use default 'connect.sid')
}));

// Add user info to all requests
app.use(addUserToLocals);

const PORT = process.env.PORT || 3000
const MONGO_URL = process.env.MONGO_URL

// logger middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
})

// Static file serving with cache headers
app.use(express.static('public', {
    maxAge: '1d', // Cache for 1 day
    etag: true
}));

app.use('/assets', express.static('assets', {
    maxAge: '7d', // Cache images for 7 days
    etag: true,
    immutable: true
}));

// Use routers
app.use('/auth', authRoutes);
app.use('/', pageRoutes);
app.use('/api', apiRoutes);
app.use('/', contactRoutes);

async function main() {
    await mongoose.connect(MONGO_URL)
    console.log("MongoDB connected")


    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
}

main().catch(err => console.log(err));

// 404 handler - must be last
app.use((req, res) => {
    // If the request is for an API route, return JSON
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Otherwise, return the 404 HTML page
    res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});
