import express from 'express';
import os from 'os';
import { exec } from 'child_process';
import mongoose from 'mongoose';

const router = express.Router();

// Helper function to normalize OS type to plain text
function normalizeOSType(osType) {
    const osMap = {
        'Darwin': 'macOS',
        'Windows_NT': 'Windows',
        'Linux': 'Linux'
    };
    return osMap[osType] || osType;
}

// Define Server schema and model for CRUD operations
const serverSchema = new mongoose.Schema({
    hostname: { type: String, required: true },
    username: { type: String, required: true },
    identifier: { type: String, required: true, unique: true }, // username@hostname
    arch: { type: String, required: true },
    os_type: { type: String, required: true },
    release: { type: String, required: true },
    cpuModel: { type: String },
    totalMemory: { type: Number },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

const Server = mongoose.model('Server', serverSchema);

// Define Metrics schema with server reference
const metricsSchema = new mongoose.Schema({
    server_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    cpuLoad: [Number],
    freeMem: Number,
    totalMem: Number,
    uptime: Number,
    networkInterfaces: {
        type: Map,
        of: [{
            address: String,
            netmask: String,
            family: String,
            mac: String,
            internal: Boolean,
            cidr: String
        }]
    },
    timestamp: { type: Date, default: Date.now }
});

const Metrics = mongoose.model('Metrics', metricsSchema);

// Static system stats
router.get('/static-stats', (req, res) => {
    const data = {
        arch: os.arch(),
        release: os.release(),
        type: normalizeOSType(os.type()),
        hostname: os.hostname(),
        userInfo: os.userInfo(),
        cpus: os.cpus(),
    };
    res.json(data);
});

// Dynamic system stats (saves to database with server association)
router.get('/stats', async (req, res) => {
    try {
        const allInterfaces = os.networkInterfaces();

        // Filter interfaces by name (enp8s, tailscale, wlan)
        const filteredInterfaces = {};
        Object.keys(allInterfaces).forEach(name => {
            if (name.includes('enp8s') || name.includes('tailscale') || name.includes('wlan')) {
                filteredInterfaces[name] = allInterfaces[name];
            }
        });

        // Get server information
        const hostname = os.hostname();
        const username = os.userInfo().username;
        const identifier = `${username}@${hostname}`;

        // Find or create server entry
        let server = await Server.findOne({ identifier });

        if (!server) {
            // Create new server entry
            server = new Server({
                hostname,
                username,
                identifier,
                arch: os.arch(),
                os_type: normalizeOSType(os.type()),
                release: os.release(),
                cpuModel: os.cpus()[0]?.model || 'Unknown',
                totalMemory: os.totalmem(),
                lastSeen: new Date(),
                createdAt: new Date()
            });
            await server.save();
            console.log(`New server registered: ${identifier}`);
        } else {
            // Update server information (kernel, CPU, memory might change over time)
            const currentRelease = os.release();
            const currentCpuModel = os.cpus()[0]?.model || 'Unknown';
            const currentTotalMemory = os.totalmem();

            let updated = false;

            if (server.release !== currentRelease) {
                console.log(`Server ${identifier}: Kernel updated from ${server.release} to ${currentRelease}`);
                server.release = currentRelease;
                updated = true;
            }

            if (server.cpuModel !== currentCpuModel) {
                console.log(`Server ${identifier}: CPU model updated to ${currentCpuModel}`);
                server.cpuModel = currentCpuModel;
                updated = true;
            }

            if (server.totalMemory !== currentTotalMemory) {
                console.log(`Server ${identifier}: Total memory updated to ${(currentTotalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
                server.totalMemory = currentTotalMemory;
                updated = true;
            }

            // Always update lastSeen
            server.lastSeen = new Date();

            if (updated) {
                console.log(`Server ${identifier}: Hardware/OS information updated`);
            }

            await server.save();
        }

        const metrics = new Metrics({
            server_id: server._id,
            cpuLoad: os.loadavg(),
            freeMem: os.freemem(),
            totalMem: os.totalmem(),
            uptime: os.uptime(),
            networkInterfaces: filteredInterfaces,
            timestamp: new Date()
        });
 
        await metrics.save();

        // Always return current stats (whether we saved or not)
        const response = {
            cpuLoad: os.loadavg(),
            freeMem: os.freemem(),
            totalMem: os.totalmem(),
            uptime: os.uptime(),
            networkInterfaces: filteredInterfaces,
            timestamp: new Date(),
            server: {
                identifier,
                hostname,
                username
            },
        };

        res.json(response);
    } catch (error) {
        console.error('Error saving metrics:', error);
        res.status(500).json({ error: 'Failed to save metrics' });
    }
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

// Network statistics from /proc/net/dev
router.get('/network-stats', (req, res) => {
    exec('cat /proc/net/dev', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error reading network statistics' });
            return;
        }

        // Parse the output
        const lines = stdout.split('\n');
        const stats = {};

        // Skip first 2 header lines
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(/\s+/);
            const interfaceName = parts[0].replace(':', '');

            // Filter for specific interfaces
            if (interfaceName.includes('enp8s') || interfaceName.includes('tailscale') || interfaceName.includes('wlan')) {
                stats[interfaceName] = {
                    rxBytes: parseInt(parts[1]),
                    rxPackets: parseInt(parts[2]),
                    txBytes: parseInt(parts[9]),
                    txPackets: parseInt(parts[10])
                };
            }
        }

        res.json(stats);
    });
});

// Per-core CPU usage from /proc/stat
router.get('/cpu-per-core', (req, res) => {
    exec('cat /proc/stat', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error reading CPU statistics' });
            return;
        }

        const lines = stdout.split('\n');
        const cpuData = [];

        for (const line of lines) {
            if (line.startsWith('cpu') && line !== lines[0]) { // Skip the first 'cpu' line (aggregate)
                const parts = line.split(/\s+/);
                const cpuName = parts[0];

                // Parse CPU times: user, nice, system, idle, iowait, irq, softirq, steal
                const times = {
                    user: parseInt(parts[1]) || 0,
                    nice: parseInt(parts[2]) || 0,
                    system: parseInt(parts[3]) || 0,
                    idle: parseInt(parts[4]) || 0,
                    iowait: parseInt(parts[5]) || 0,
                    irq: parseInt(parts[6]) || 0,
                    softirq: parseInt(parts[7]) || 0,
                    steal: parseInt(parts[8]) || 0
                };

                cpuData.push({
                    name: cpuName,
                    times: times
                });
            }
        }

        res.json(cpuData);
    });
});


// ==================== CRUD API ROUTES FOR SERVERS ====================

// GET /api/servers - Return all servers (with filtering, sorting, projection support)
router.get('/servers', async (req, res) => {
    try {
        const { sort, limit, fields } = req.query;

        let query = Server.find();

        // Apply sorting (e.g., ?sort=lastSeen or ?sort=-createdAt)
        if (sort) {
            query = query.sort(sort);
        } else {
            query = query.sort({ lastSeen: -1 }); // Default: most recently seen first
        }

        // Apply limit
        if (limit) {
            query = query.limit(parseInt(limit));
        }

        // Apply field projection (e.g., ?fields=hostname,identifier)
        if (fields) {
            query = query.select(fields.split(',').join(' '));
        }

        const servers = await query;

        // Add metrics count for each server
        const serversWithCounts = await Promise.all(
            servers.map(async (server) => {
                const metricsCount = await Metrics.countDocuments({ server_id: server._id });
                return {
                    ...server.toObject(),
                    metricsCount
                };
            })
        );

        res.status(200).json(serversWithCounts);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/servers/:id - Return a single server by MongoDB _id or identifier
router.get('/servers/:id', async (req, res) => {
    const { id } = req.params;

    try {
        let server;

        // Try to find by MongoDB _id first
        if (mongoose.Types.ObjectId.isValid(id)) {
            server = await Server.findById(id);
        }

        // If not found, try by identifier (username@hostname)
        if (!server) {
            server = await Server.findOne({ identifier: id });
        }

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Get metrics count for this server
        const metricsCount = await Metrics.countDocuments({ server_id: server._id });

        res.status(200).json({
            ...server.toObject(),
            metricsCount
        });
    } catch (error) {
        console.error('Error fetching server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/servers - Create a new server manually
router.post('/servers', async (req, res) => {
    const { hostname, username, arch, os_type, release, cpuModel, totalMemory } = req.body;

    // Validate required fields
    if (!hostname || !username || !arch || !os_type || !release) {
        return res.status(400).json({
            error: 'Missing required fields. Required: hostname, username, arch, os_type, release'
        });
    }

    try {
        const identifier = `${username}@${hostname}`;

        // Check if server with this identifier already exists
        const existingServer = await Server.findOne({ identifier });
        if (existingServer) {
            return res.status(400).json({ error: 'Server with this identifier already exists' });
        }

        const newServer = new Server({
            hostname,
            username,
            identifier,
            arch,
            os_type,
            release,
            cpuModel: cpuModel || 'Unknown',
            totalMemory: totalMemory || 0,
            lastSeen: new Date(),
            createdAt: new Date()
        });

        await newServer.save();
        res.status(201).json(newServer);
    } catch (error) {
        console.error('Error creating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/servers/:id - Update an existing server by MongoDB _id
router.put('/servers/:id', async (req, res) => {
    const { id } = req.params;
    const { hostname, username, arch, os_type, release, cpuModel, totalMemory } = req.body;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    // Build update object with provided fields only
    const updateFields = {};
    if (hostname) updateFields.hostname = hostname;
    if (username) updateFields.username = username;
    if (arch) updateFields.arch = arch;
    if (os_type) updateFields.os_type = os_type;
    if (release) updateFields.release = release;
    if (cpuModel) updateFields.cpuModel = cpuModel;
    if (totalMemory !== undefined) updateFields.totalMemory = totalMemory;

    // Update identifier if hostname or username changed
    if (hostname || username) {
        const server = await Server.findById(id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        const newHostname = hostname || server.hostname;
        const newUsername = username || server.username;
        updateFields.identifier = `${newUsername}@${newHostname}`;
    }

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
            error: 'At least one field must be provided for update'
        });
    }

    try {
        const updatedServer = await Server.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
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

// DELETE /api/servers/:id - Delete a server by MongoDB _id (supports dry-run)
router.delete('/servers/:id', async (req, res) => {
    const { id } = req.params;
    const { dryRun } = req.query;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        // Find the server first
        const server = await Server.findById(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Count metrics that would be deleted
        const metricsCount = await Metrics.countDocuments({ server_id: id });

        // If dry-run mode, return what would be deleted without actually deleting
        if (dryRun === 'true') {
            return res.status(200).json({
                message: 'Dry-run mode: No data was deleted',
                dryRun: true,
                wouldDelete: {
                    server: server,
                    metricsCount: metricsCount
                }
            });
        }

        // Perform actual deletion
        const deletedServer = await Server.findByIdAndDelete(id);
        const deletedMetrics = await Metrics.deleteMany({ server_id: id });
        console.log(`Deleted ${deletedMetrics.deletedCount} metrics for server ${deletedServer.identifier}`);

        res.status(200).json({
            message: 'Server deleted successfully',
            server: deletedServer,
            metricsDeleted: deletedMetrics.deletedCount
        });
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/servers/:id/metrics - Get metrics for a specific server
router.get('/servers/:id/metrics', async (req, res) => {
    const { id } = req.params;
    const { limit, since } = req.query;

    try {
        let server;

        // Find server by _id or identifier
        if (mongoose.Types.ObjectId.isValid(id)) {
            server = await Server.findById(id);
        } else {
            server = await Server.findOne({ identifier: id });
        }

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Build query
        let query = Metrics.find({ server_id: server._id }).sort({ timestamp: -1 });

        // Filter by time if 'since' parameter provided (minutes ago)
        if (since) {
            const sinceDate = new Date(Date.now() - parseInt(since) * 60 * 1000);
            query = query.where('timestamp').gte(sinceDate);
        }

        // Apply limit
        if (limit) {
            query = query.limit(parseInt(limit));
        } else {
            query = query.limit(100); // Default limit
        }

        const metrics = await query;

        res.status(200).json({
            server: {
                _id: server._id,
                identifier: server.identifier,
                hostname: server.hostname,
                username: server.username
            },
            count: metrics.length,
            metrics
        });
    } catch (error) {
        console.error('Error fetching server metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export { Metrics, Server };
export default router;

