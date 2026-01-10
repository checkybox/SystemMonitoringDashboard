import express from 'express';
import os from 'os';
import { exec } from 'child_process';
import mongoose from 'mongoose';

const router = express.Router();

// Define Metrics schema and model
const metricsSchema = new mongoose.Schema({
    cpuLoad: [Number],
    freeMem: Number,
    totalMem: Number,
    uptime: Number,
    timestamp: { type: Date, default: Date.now }
});

const Metrics = mongoose.model('Metrics', metricsSchema);

// Project info endpoint
router.get('/info', (req, res) => {
    const projectInfo = {
        projectName: 'System Monitoring Dashboard',
        version: '1.0.0',
        description: 'A minimal web-based dashboard for viewing system metrics such as CPU load, memory usage, uptime, and more.',
        author: 'Vitaliy Golubenko (SE-2423)',
        routes: {
            pages: [
                { path: '/', method: 'GET', description: 'Home page with system overview' },
                { path: '/about', method: 'GET', description: 'About page with team info and planned features' },
                { path: '/contact', method: 'GET', description: 'Contact form page' },
                { path: '/search', method: 'GET', description: 'Search page (query parameter: q)' },
                { path: '/item/:id', method: 'GET', description: 'Item detail page (route parameter: id)' }
            ],
            api: [
                { path: '/api/info', method: 'GET', description: 'Returns project information in JSON format' },
                { path: '/api/static-stats', method: 'GET', description: 'Returns static system information' },
                { path: '/api/stats', method: 'GET', description: 'Returns dynamic system statistics' },
                { path: '/api/os-release', method: 'GET', description: 'Returns OS release information' },
                { path: '/api/disk-usage', method: 'GET', description: 'Returns disk usage statistics' },
                { path: '/api/free', method: 'GET', description: 'Returns memory usage information' }
            ],
            forms: [
                { path: '/contact', method: 'POST', description: 'Handles contact form submission' }
            ]
        },
        timestamp: new Date().toISOString()
    };

    res.json(projectInfo);
});

// Static system stats
router.get('/static-stats', (req, res) => {
    const data = {
        arch: os.arch(),
        release: os.release(),
        type: os.type(),
        hostname: os.hostname(),
        userInfo: os.userInfo(),
        cpus: os.cpus(),
    };
    res.json(data);
});

// Dynamic system stats (saves to database)
router.get('/stats', (req, res) => {
    const data = {
        freeMem: os.freemem(),
        homedir: os.homedir(),
        cpuLoad: os.loadavg(),
        machine: os.machine(),
        networkInterfaces: os.networkInterfaces(),
        totalMem: os.totalmem(),
        uptime: os.uptime(),
    };

    const metrics = new Metrics({
        cpuLoad: data.cpuLoad,
        freeMem: data.freeMem,
        totalMem: data.totalMem,
        uptime: data.uptime,
        timestamp: new Date()
    });

    metrics.save().then(() => console.log("Metrics saved to database"));

    res.json(data);
});

// OS release information
router.get('/os-release', (req, res) => {
    exec('cat /etc/os-release', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error executing command');
            return;
        }
        res.send(stdout);
    });
});

// Disk usage
router.get('/disk-usage', (req, res) => {
    exec('df -h', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error executing command');
            return;
        }
        res.send(stdout);
    });
});

// Memory usage
router.get('/free', (req, res) => {
    exec('free -h', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error executing command');
            return;
        }
        res.send(stdout);
    });
});

// List directory (debug endpoint)
router.get('/ls', (req, res) => {
    exec('ls -l', (err, stdout) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${err}`);
    });
    res.send('Executed ls -l command. Check server console for output.');
});

export { Metrics };
export default router;

