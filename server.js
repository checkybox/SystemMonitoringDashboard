import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routers
import pageRoutes from './routes/pageRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import authRoutes from './routes/authRoutes.js';

// Import middleware
import { addUserToLocals } from './middleware/auth.js';

// Import config
import { connectDB } from './config/db.js';
import { createSessionMiddleware } from './config/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

// Trust proxy - CRITICAL for Render (behind reverse proxy)
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Session configuration
app.use(createSessionMiddleware());

// Add user info to all requests
app.use(addUserToLocals);

const PORT = process.env.PORT || 3000
const MONGO_URL = process.env.MONGO_URL

async function main() {
    await connectDB(MONGO_URL);

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
}

main().catch(err => console.log(err));

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

// 404 handler - must be last
app.use((req, res) => {
    // If the request is for an API route, return JSON
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Otherwise, return the 404 HTML page
    res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});
