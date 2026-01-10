import express from 'express';
import os from 'os';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routers
import pageRoutes from './routes/pageRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import { Metrics } from './routes/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const PORT = process.env.PORT || 3000
const MONGO_URL = process.env.MONGO_URL

async function main() {
    await mongoose.connect(MONGO_URL)
    console.log("MongoDB connected")

    // Save initial metrics
    const newMetrics = new Metrics({
        cpuLoad: os.loadavg(),
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        uptime: os.uptime(),
        timestamp: new Date()
    });
    await newMetrics.save().then(() => console.log("Initial metrics saved"));

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

app.use(express.static('public')) // expose public directory
app.use('/assets', express.static('assets')) // expose assets directory on mount point /assets

// Use routers
app.use('/', pageRoutes);
app.use('/api', apiRoutes);
app.use('/', contactRoutes);

// 404 handler - must be last
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});
