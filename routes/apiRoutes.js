import express from 'express';
import os from 'os';
import { exec } from 'child_process';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

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
    ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Which user owns this machine
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

const Server = mongoose.model('Server', serverSchema);

// Define Metrics schema with server reference
const metricsSchema = new mongoose.Schema({
    server_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    cpuLoad: [Number],
    cpus: [{
        model: String,
        speed: Number,
        times: {
            user: Number,
            nice: Number,
            sys: Number,
            idle: Number,
            irq: Number
        }
    }],
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
    networkStats: {
        type: Map,
        of: {
            rxBytes: Number,
            rxPackets: Number,
            txBytes: Number,
            txPackets: Number
        }
    },
    diskUsage: {
        filesystem: String,
        size: String,
        used: String,
        available: String,
        usePercent: String,
        mountPoint: String
    },
    timestamp: { type: Date, default: Date.now }
});

const Metrics = mongoose.model('Metrics', metricsSchema);

// Helper function to check if we're running in hosted environment (not localhost)
function isHostedEnvironment() {
    const hostname = os.hostname();
    // Check if we're on Render or similar hosting platforms
    return process.env.RENDER ||
           process.env.RAILWAY_ENVIRONMENT ||
           process.env.VERCEL ||
           hostname.includes('render') ||
           hostname.includes('railway') ||
           hostname.includes('vercel');
}

// Check if running in hosted mode (PROTECTED)
router.get('/environment', requireAuth, (req, res) => {
    res.json({
        isHosted: isHostedEnvironment(),
        hostname: os.hostname()
    });
});

// POST endpoint for agents to push metrics
router.post('/agent-metrics', async (req, res) => {
    try {
        const {
            cpuLoad, cpus, freeMem, totalMem, uptime, networkInterfaces, networkStats, diskUsage,
            hostname, username, arch, os_type, release, cpuModel, registrationCode
        } = req.body;

        // Validate required fields
        if (!hostname || !username || !cpuLoad || freeMem === undefined || totalMem === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['hostname', 'username', 'cpuLoad', 'freeMem', 'totalMem']
            });
        }

        const identifier = `${username}@${hostname}`;

        // Initialize global runtime storage for registration codes
        if (!global.serverRegistrationCodes) {
            global.serverRegistrationCodes = new Map();
        }

        // Store registration code in runtime memory (dynamic ownership)
        if (registrationCode) {
            global.serverRegistrationCodes.set(identifier, registrationCode.toUpperCase());
            console.log(`✓ Server ${identifier} using registration code ${registrationCode}`);
        } else {
            global.serverRegistrationCodes.delete(identifier);
            console.log(`⚠ Server ${identifier} has no registration code (unclaimed)`);
        }

        // Find or create server entry (NO ownedBy field stored in DB)
        let server = await Server.findOne({ identifier });
        let isNewServer = false;

        if (!server) {
            isNewServer = true;
            server = new Server({
                hostname,
                username,
                identifier,
                arch: arch || 'unknown',
                os_type: os_type || 'unknown',
                release: release || 'unknown',
                cpuModel: cpuModel || 'Unknown',
                totalMemory: totalMem,
                lastSeen: new Date(),
                createdAt: new Date()
            });
        }

        await server.save();

        if (isNewServer) {
            console.log(`New agent registered: ${identifier}`);
        } else {
            // Update server information for existing servers
            const currentRelease = release || server.release;
            const currentCpuModel = cpuModel || server.cpuModel;
            const currentTotalMemory = totalMem || server.totalMemory;

            let updated = false;

            if (server.release !== currentRelease) {
                server.release = currentRelease;
                updated = true;
            }

            if (server.cpuModel !== currentCpuModel) {
                server.cpuModel = currentCpuModel;
                updated = true;
            }

            if (server.totalMemory !== currentTotalMemory) {
                server.totalMemory = currentTotalMemory;
                updated = true;
            }

            server.lastSeen = new Date();

            if (updated) {
                await server.save();
                console.log(`Agent ${identifier}: Information updated`);
            } else {
                server.lastSeen = new Date();
                await server.save();
            }
        }

        // Save metrics
        const metrics = new Metrics({
            server_id: server._id,
            cpuLoad,
            cpus: cpus || [],
            freeMem,
            totalMem,
            uptime: uptime || 0,
            networkInterfaces: networkInterfaces || {},
            networkStats: networkStats || {},
            diskUsage: diskUsage || null,
            timestamp: new Date()
        });

        await metrics.save();

        res.status(201).json({
            message: 'Metrics received successfully',
            server_id: server._id,
            identifier
        });
    } catch (error) {
        console.error('Error receiving agent metrics:', error);
        res.status(500).json({ error: 'Failed to save metrics' });
    }
});

// Static system stats (PROTECTED)
router.get('/static-stats', requireAuth, async (req, res) => {
    try {
        const hosted = isHostedEnvironment();
        const { server_id } = req.query;

        // If server_id is provided (even on localhost), fetch from database
        if (server_id) {
            if (!mongoose.Types.ObjectId.isValid(server_id)) {
                return res.status(400).json({ error: 'Invalid server_id' });
            }

            const server = await Server.findById(server_id);

            if (!server) {
                return res.status(404).json({
                    error: 'Server not found',
                    message: 'The selected server does not exist.',
                    hosted: hosted
                });
            }

            // Check ownership for regular users
            const isAdmin = req.session.user && req.session.user.role === 'admin';
            const userId = req.session.userId;

            // Initialize runtime storage if not exists
            if (!global.serverRegistrationCodes) {
                global.serverRegistrationCodes = new Map();
            }

            if (!isAdmin) {
                const currentUser = await mongoose.model('User').findById(userId);
                const serverRegCode = global.serverRegistrationCodes.get(server.identifier);

                if (hosted) {
                    // Hosted: strict - must match user's registration code
                    if (!currentUser || !currentUser.registrationCode) {
                        return res.status(403).json({
                            error: 'Access denied',
                            message: 'You need a registration code to access servers'
                        });
                    }

                    if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                        return res.status(403).json({
                            error: 'Access denied',
                            message: 'You can only access your own servers'
                        });
                    }
                } else {
                    // Localhost: allow if unclaimed OR matches user's code
                    if (serverRegCode && currentUser && currentUser.registrationCode) {
                        if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                            return res.status(403).json({
                                error: 'Access denied',
                                message: 'You can only access your own servers'
                            });
                        }
                    }
                }
            }

            // Return static info in expected format
            return res.json({
                arch: server.arch,
                release: server.release,
                type: server.os_type,
                hostname: server.hostname,
                userInfo: { username: server.username },
                cpus: [{ model: server.cpuModel }],
                hosted: hosted
            });
        }

        // Hosted mode without server_id - require selection
        if (hosted) {
            return res.status(404).json({
                error: 'No server selected',
                message: 'Please select a server to monitor.',
                hosted: true,
                requiresSelection: true
            });
        }

        // Local mode without server_id - return current machine info
        const data = {
            arch: os.arch(),
            release: os.release(),
            type: normalizeOSType(os.type()),
            hostname: os.hostname(),
            userInfo: os.userInfo(),
            cpus: os.cpus(),
            hosted: false
        };
        res.json(data);
    } catch (error) {
        console.error('Error fetching static stats:', error);
        res.status(500).json({ error: 'Failed to fetch static stats' });
    }
});

// Dynamic system stats (saves to database with server association) (PROTECTED)
// In hosted mode, returns latest metrics from database instead of collecting locally
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const hosted = isHostedEnvironment();
        const { server_id } = req.query;

        // If server_id is provided (even on localhost), fetch from database
        if (server_id) {
            if (!mongoose.Types.ObjectId.isValid(server_id)) {
                return res.status(400).json({ error: 'Invalid server_id' });
            }

            // Get latest metrics for the specified server
            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 })
                .populate('server_id');

            if (!latestMetrics) {
                return res.status(404).json({
                    error: 'No metrics available for this server',
                    message: 'The agent may not be sending data.',
                    hosted: hosted
                });
            }

            // Check ownership for regular users
            const isAdmin = req.session.user && req.session.user.role === 'admin';
            const userId = req.session.userId;

            // Initialize runtime storage if not exists
            if (!global.serverRegistrationCodes) {
                global.serverRegistrationCodes = new Map();
            }

            if (!isAdmin && latestMetrics.server_id) {
                const server = latestMetrics.server_id;
                const currentUser = await mongoose.model('User').findById(userId);
                const serverRegCode = global.serverRegistrationCodes.get(server.identifier);

                if (hosted) {
                    // Hosted: strict - must match user's registration code
                    if (!currentUser || !currentUser.registrationCode) {
                        return res.status(403).json({
                            error: 'Access denied',
                            message: 'You need a registration code to access servers'
                        });
                    }

                    if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                        return res.status(403).json({
                            error: 'Access denied',
                            message: 'You can only access your own servers'
                        });
                    }
                } else {
                    // Localhost: allow if unclaimed OR matches user's code
                    if (serverRegCode && currentUser && currentUser.registrationCode) {
                        if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                            return res.status(403).json({
                                error: 'Access denied',
                                message: 'You can only access your own servers'
                            });
                        }
                    }
                }
            }

            // Return metrics in expected format
            return res.json({
                cpuLoad: latestMetrics.cpuLoad,
                cpus: latestMetrics.cpus || [],
                freeMem: latestMetrics.freeMem,
                totalMem: latestMetrics.totalMem,
                uptime: latestMetrics.uptime,
                networkInterfaces: latestMetrics.networkInterfaces,
                diskUsage: latestMetrics.diskUsage || null,
                timestamp: latestMetrics.timestamp,
                server: latestMetrics.server_id ? {
                    identifier: latestMetrics.server_id.identifier,
                    hostname: latestMetrics.server_id.hostname,
                    username: latestMetrics.server_id.username
                } : null,
                hosted: hosted
            });
        }

        // Hosted mode without server_id - require selection
        if (hosted) {
            return res.status(404).json({
                error: 'No server selected',
                message: 'Please select a server to monitor.',
                hosted: true,
                requiresSelection: true
            });
        }

        // Local mode without server_id - collect metrics from current machine
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
            hosted: false
        };

        res.json(response);
    } catch (error) {
        console.error('Error saving metrics:', error);
        res.status(500).json({ error: 'Failed to save metrics' });
    }
});

// OS release information (PROTECTED)
router.get('/os-release', requireAuth, (req, res) => {
    exec('cat /etc/os-release', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error executing command');
            return;
        }
        res.send(stdout);
    });
});

// Disk usage (PROTECTED)
router.get('/disk-usage', requireAuth, async (req, res) => {
    try {
        const hosted = isHostedEnvironment();

        if (hosted) {
            // In hosted mode, REQUIRE server_id parameter
            const { server_id } = req.query;

            if (!server_id) {
                return res.status(404).send('No server selected');
            }

            if (!mongoose.Types.ObjectId.isValid(server_id)) {
                return res.status(400).json({ error: 'Invalid server_id' });
            }

            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 });

            if (!latestMetrics || !latestMetrics.diskUsage) {
                return res.status(404).send('No disk data available');
            }

            const disk = latestMetrics.diskUsage;
            // Format as df -h output
            const output = `Filesystem      Size  Used Avail Use% Mounted on\n${disk.filesystem || 'N/A'}  ${disk.size || 'N/A'}  ${disk.used || 'N/A'}   ${disk.available || 'N/A'}  ${disk.usePercent || 'N/A'} ${disk.mountPoint || '/'}`;
            return res.send(output);
        }

        // Local mode - execute df command
        exec('df -h', (err, stdout) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error executing command');
                return;
            }
            res.send(stdout);
        });
    } catch (error) {
        console.error('Error fetching disk usage:', error);
        res.status(500).send('Error fetching disk usage');
    }
});

// Network statistics from /proc/net/dev (PROTECTED)
router.get('/network-stats', requireAuth, async (req, res) => {
    try {
        const hosted = isHostedEnvironment();

        if (hosted) {
            // In hosted mode, REQUIRE server_id parameter
            const { server_id } = req.query;

            if (!server_id) {
                return res.json({}); // Return empty if no server selected
            }

            if (!mongoose.Types.ObjectId.isValid(server_id)) {
                return res.status(400).json({ error: 'Invalid server_id' });
            }

            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 });

            if (!latestMetrics || !latestMetrics.networkStats) {
                return res.json({}); // Return empty object if no data
            }

            // Convert Map to plain object
            const stats = {};
            if (latestMetrics.networkStats instanceof Map) {
                latestMetrics.networkStats.forEach((value, key) => {
                    stats[key] = value;
                });
            } else {
                Object.assign(stats, latestMetrics.networkStats);
            }

            return res.json(stats);
        }

        // Local mode - read from /proc/net/dev
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

                // Skip virtual interfaces
                const isVirtualInterface =
                    interfaceName === 'lo' ||
                    interfaceName.startsWith('veth') ||
                    interfaceName.startsWith('docker') ||
                    interfaceName.startsWith('virbr') ||
                    interfaceName.startsWith('br-') ||
                    interfaceName.startsWith('vnet');

                if (isVirtualInterface) {
                    continue;
                }

                // Filter for physical/useful interfaces
                if (interfaceName.includes('enp') ||
                    interfaceName.includes('tailscale') ||
                    interfaceName.includes('wlan') ||
                    interfaceName.includes('eth') ||
                    interfaceName.startsWith('wl') ||
                    interfaceName.match(/^en[ops]\d+/)) {
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
    } catch (error) {
        console.error('Error fetching network stats:', error);
        res.status(500).json({ error: 'Failed to fetch network stats' });
    }
});

// Per-core CPU usage (PROTECTED)
router.get('/cpu-per-core', requireAuth, async (req, res) => {
    try {
        const hosted = isHostedEnvironment();

        if (hosted) {
            // In hosted mode, REQUIRE server_id parameter
            const { server_id } = req.query;

            if (!server_id) {
                return res.status(404).json({
                    error: 'No server selected',
                    hosted: true
                });
            }

            if (!mongoose.Types.ObjectId.isValid(server_id)) {
                return res.status(400).json({ error: 'Invalid server_id' });
            }

            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 });

            if (!latestMetrics || !latestMetrics.cpus) {
                return res.status(404).json({ error: 'No CPU data available' });
            }

            // Transform cpus data to match expected format
            const cpuData = latestMetrics.cpus.map((cpu, index) => ({
                name: `cpu${index}`,
                times: {
                    user: cpu.times.user,
                    nice: cpu.times.nice,
                    system: cpu.times.sys,
                    idle: cpu.times.idle,
                    iowait: 0,
                    irq: cpu.times.irq || 0,
                    softirq: 0,
                    steal: 0
                }
            }));

            return res.json(cpuData);
        }

        // Local mode - read from /proc/stat
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
    } catch (error) {
        console.error('Error fetching CPU data:', error);
        res.status(500).json({ error: 'Failed to fetch CPU data' });
    }
});


// ==================== CRUD API ROUTES FOR SERVERS ====================

// GET /api/servers - Return all servers with metrics count (PROTECTED)
router.get('/servers', requireAuth, async (req, res) => {
    try {
        const { sort, limit, fields } = req.query;

        // Check user role
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        const userId = req.session.userId;
        const hosted = isHostedEnvironment();

        // Initialize runtime storage if not exists
        if (!global.serverRegistrationCodes) {
            global.serverRegistrationCodes = new Map();
        }

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

        // Calculate ownership dynamically from runtime registration codes
        let filteredServers = servers;

        if (!isAdmin && hosted) {
            // For regular users on hosted: filter by dynamic ownership
            const currentUser = await mongoose.model('User').findById(userId);
            if (currentUser && currentUser.registrationCode) {
                filteredServers = servers.filter(server => {
                    const serverRegCode = global.serverRegistrationCodes.get(server.identifier);
                    return serverRegCode === currentUser.registrationCode.toUpperCase();
                });
            } else {
                filteredServers = []; // No code = no servers
            }
        } else if (!isAdmin && !hosted) {
            // For regular users on localhost: show owned + unclaimed
            const currentUser = await mongoose.model('User').findById(userId);
            const userRegCode = currentUser ? currentUser.registrationCode?.toUpperCase() : null;

            filteredServers = servers.filter(server => {
                const serverRegCode = global.serverRegistrationCodes.get(server.identifier);
                // Show if: no code (unclaimed) OR matches user's code
                return !serverRegCode || serverRegCode === userRegCode;
            });
        }

        // Add metrics count for each server
        const serversWithCounts = await Promise.all(
            filteredServers.map(async (server) => {
                const metricsCount = await Metrics.countDocuments({ server_id: server._id });

                // Add dynamic ownership info (for display purposes)
                const serverRegCode = global.serverRegistrationCodes.get(server.identifier);
                let ownerInfo = null;

                if (serverRegCode) {
                    const owner = await mongoose.model('User').findOne({
                        registrationCode: serverRegCode
                    });
                    if (owner) {
                        ownerInfo = {
                            username: owner.username,
                            fullName: owner.fullName
                        };
                    }
                }

                return {
                    ...server.toObject(),
                    metricsCount,
                    dynamicOwner: ownerInfo // Dynamic ownership info
                };
            })
        );

        res.status(200).json(serversWithCounts);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/servers/:id - Return a single server by MongoDB _id or identifier (PROTECTED)
router.get('/servers/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        // Check user role
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        const userId = req.session.userId;

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

        // Initialize runtime storage if not exists
        if (!global.serverRegistrationCodes) {
            global.serverRegistrationCodes = new Map();
        }

        // Regular users: check dynamic ownership
        if (!isAdmin) {
            const hosted = isHostedEnvironment();
            const currentUser = await mongoose.model('User').findById(userId);
            const serverRegCode = global.serverRegistrationCodes.get(server.identifier);

            if (hosted) {
                // Hosted: strict - must match user's registration code
                if (!currentUser || !currentUser.registrationCode) {
                    return res.status(403).json({
                        error: 'Access denied',
                        message: 'You need a registration code to access servers'
                    });
                }

                if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                    return res.status(403).json({
                        error: 'Access denied',
                        message: 'You can only access your own servers'
                    });
                }
            } else {
                // Localhost: allow if unclaimed OR matches user's code
                if (serverRegCode && currentUser && currentUser.registrationCode) {
                    if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                        return res.status(403).json({
                            error: 'Access denied',
                            message: 'You can only access your own servers'
                        });
                    }
                }
            }
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

// POST /api/servers - Create a new server manually (ADMIN ONLY)
router.post('/servers', requireAdmin, async (req, res) => {
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

// PUT /api/servers/:id - Update an existing server by MongoDB _id (ADMIN ONLY)
router.put('/servers/:id', requireAdmin, async (req, res) => {
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

// DELETE /api/servers/:id - Delete a server by MongoDB _id (supports dry-run) (ADMIN ONLY)
router.delete('/servers/:id', requireAdmin, async (req, res) => {
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

// POST /api/servers/:id/claim - Regular users claim ownership of a server
router.post('/servers/:id/claim', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        // Only regular users can claim servers
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        if (isAdmin) {
            return res.status(400).json({
                error: 'Admins cannot claim servers',
                message: 'Only regular users can claim server ownership'
            });
        }

        const userId = req.session.userId;

        // Find the server
        let server;
        if (mongoose.Types.ObjectId.isValid(id)) {
            server = await Server.findById(id);
        } else {
            server = await Server.findOne({ identifier: id });
        }

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Check if server is already claimed
        if (server.ownedBy && server.ownedBy.toString() !== userId.toString()) {
            return res.status(403).json({
                error: 'Server already claimed',
                message: 'This server is already owned by another user'
            });
        }

        // Claim the server
        server.ownedBy = userId;
        await server.save();

        res.status(200).json({
            message: 'Server claimed successfully',
            server: {
                _id: server._id,
                identifier: server.identifier,
                hostname: server.hostname
            }
        });
    } catch (error) {
        console.error('Error claiming server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/servers/:id/metrics - Get metrics for a specific server (PROTECTED)
router.get('/servers/:id/metrics', requireAuth, async (req, res) => {
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

