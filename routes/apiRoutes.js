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

// Define Server schema and model for CRUD operations
const serverSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    hostname: { type: String, required: true },
    arch: { type: String, required: true },
    os_type: { type: String, required: true },
    release: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Server = mongoose.model('Server', serverSchema);

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

    console.log(data.networkInterfaces)

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

// ==================== CRUD API ROUTES FOR SERVERS ====================

// GET /api/servers - Return all servers (sorted by id ASC)
router.get('/servers', async (req, res) => {
    try {
        const servers = await Server.find().sort({ id: 1 });
        res.status(200).json(servers);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/servers/:id - Return a single server by id
router.get('/servers/:id', async (req, res) => {
    const { id } = req.params;

    // Validate id is a number
    if (isNaN(id) || !Number.isInteger(Number(id))) {
        return res.status(400).json({ error: 'Invalid id' });
    }

    try {
        const server = await Server.findOne({ id: Number(id) });

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        res.status(200).json(server);
    } catch (error) {
        console.error('Error fetching server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/servers - Create a new server
router.post('/servers', async (req, res) => {
    const { id, hostname, arch, os_type, release } = req.body;

    // Validate required fields
    if (!id || !hostname || !arch || !os_type || !release) {
        return res.status(400).json({
            error: 'Missing required fields. Required: id, hostname, arch, os_type, release'
        });
    }

    // Validate id is a number
    if (isNaN(id) || !Number.isInteger(Number(id))) {
        return res.status(400).json({ error: 'Invalid id. Must be an integer.' });
    }

    try {
        // Check if server with this id already exists
        const existingServer = await Server.findOne({ id: Number(id) });
        if (existingServer) {
            return res.status(400).json({ error: 'Server with this id already exists' });
        }

        const newServer = new Server({
            id: Number(id),
            hostname,
            arch,
            os_type,
            release
        });

        await newServer.save();
        res.status(201).json(newServer);
    } catch (error) {
        console.error('Error creating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/servers/:id - Update an existing server by id
router.put('/servers/:id', async (req, res) => {
    const { id } = req.params;
    const { hostname, arch, os_type, release } = req.body;

    // Validate id is a number
    if (isNaN(id) || !Number.isInteger(Number(id))) {
        return res.status(400).json({ error: 'Invalid id' });
    }

    // Validate at least one field is provided
    if (!hostname && !arch && !os_type && !release) {
        return res.status(400).json({
            error: 'At least one field must be provided for update (hostname, arch, os_type, release)'
        });
    }

    try {
        const updateData = {};
        if (hostname) updateData.hostname = hostname;
        if (arch) updateData.arch = arch;
        if (os_type) updateData.os_type = os_type;
        if (release) updateData.release = release;

        const updatedServer = await Server.findOneAndUpdate(
            { id: Number(id) },
            updateData,
            { new: true } // Return the updated document
        );

        if (!updatedServer) {
            return res.status(404).json({ error: 'Server not found' });
        }

        res.status(200).json(updatedServer);
    } catch (error) {
        console.error('Error updating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/servers/:id - Delete a server by id
router.delete('/servers/:id', async (req, res) => {
    const { id } = req.params;

    // Validate id is a number
    if (isNaN(id) || !Number.isInteger(Number(id))) {
        return res.status(400).json({ error: 'Invalid id' });
    }

    try {
        const deletedServer = await Server.findOneAndDelete({ id: Number(id) });

        if (!deletedServer) {
            return res.status(404).json({ error: 'Server not found' });
        }

        res.status(200).json({ message: 'Server deleted successfully', server: deletedServer });
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export { Metrics, Server };
export default router;

