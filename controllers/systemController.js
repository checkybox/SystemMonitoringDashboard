import os from 'os';
import { exec } from 'child_process';
import Server from '../models/Server.js';
import Metrics from '../models/Metrics.js';
import {
    authorizeServerAccess,
    isHostedEnvironment,
    normalizeOSType,
    toPlainObject,
    validateObjectIdOrSend
} from './apiHelpers.js';

export const getEnvironment = (req, res) => {
    res.json({
        isHosted: isHostedEnvironment(),
        hostname: os.hostname()
    });
};

export const getStaticStats = async (req, res) => {
    try {
        const hosted = isHostedEnvironment();
        const { server_id } = req.query;

        if (server_id) {
            if (!validateObjectIdOrSend(res, server_id)) return;

            const server = await Server.findById(server_id);

            if (!server) {
                return res.status(404).json({
                    error: 'Server not found',
                    message: 'The selected server does not exist.',
                    hosted: hosted
                });
            }

            const accessError = await authorizeServerAccess({ server, req, hosted });
            if (accessError) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: accessError
                });
            }

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

        if (hosted) {
            return res.status(404).json({
                error: 'No server selected',
                message: 'Please select a server to monitor.',
                hosted: true,
                requiresSelection: true
            });
        }

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
};

export const getStats = async (req, res) => {
    try {
        const hosted = isHostedEnvironment();
        const { server_id } = req.query;

        if (server_id) {
            if (!validateObjectIdOrSend(res, server_id)) return;

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

            const serverDoc = latestMetrics.server_id;
            if (serverDoc) {
                const accessError = await authorizeServerAccess({ server: serverDoc, req, hosted });
                if (accessError) {
                    return res.status(403).json({
                        error: 'Access denied',
                        message: accessError
                    });
                }
            }

            return res.json({
                cpuLoad: latestMetrics.cpuLoad,
                cpus: latestMetrics.cpus || [],
                freeMem: latestMetrics.freeMem,
                totalMem: latestMetrics.totalMem,
                uptime: latestMetrics.uptime,
                networkInterfaces: latestMetrics.networkInterfaces,
                diskUsage: latestMetrics.diskUsage || null,
                timestamp: latestMetrics.timestamp,
                server: serverDoc ? {
                    identifier: serverDoc.identifier,
                    hostname: serverDoc.hostname,
                    username: serverDoc.username
                } : null,
                hosted: hosted
            });
        }

        if (hosted) {
            return res.status(404).json({
                error: 'No server selected',
                message: 'Please select a server to monitor.',
                hosted: true,
                requiresSelection: true
            });
        }

        const allInterfaces = os.networkInterfaces();

        const filteredInterfaces = {};
        Object.keys(allInterfaces).forEach(name => {
            if (name.includes('enp8s') || name.includes('tailscale') || name.includes('wlan')) {
                filteredInterfaces[name] = allInterfaces[name];
            }
        });

        const hostname = os.hostname();
        const username = os.userInfo().username;
        const identifier = `${username}@${hostname}`;

        let server = await Server.findOne({ identifier });

        if (!server) {
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
};

export const getOsRelease = (req, res) => {
    exec('cat /etc/os-release', (err, stdout) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error executing command');
            return;
        }
        res.send(stdout);
    });
};

export const getDiskUsage = async (req, res) => {
    try {
        const hosted = isHostedEnvironment();

        if (hosted) {
            const { server_id } = req.query;

            if (!server_id) {
                return res.status(404).send('No server selected');
            }

            if (!validateObjectIdOrSend(res, server_id)) return;

            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 });

            if (!latestMetrics || !latestMetrics.diskUsage) {
                return res.status(404).send('No disk data available');
            }

            const disk = latestMetrics.diskUsage;
            const output = `Filesystem      Size  Used Avail Use% Mounted on\n${disk.filesystem || 'N/A'}  ${disk.size || 'N/A'}  ${disk.used || 'N/A'}   ${disk.available || 'N/A'}  ${disk.usePercent || 'N/A'} ${disk.mountPoint || '/'}`;
            return res.send(output);
        }

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
};

export const getNetworkStats = async (req, res) => {
    try {
        const hosted = isHostedEnvironment();

        if (hosted) {
            const { server_id } = req.query;

            if (!server_id) {
                return res.json({});
            }

            if (!validateObjectIdOrSend(res, server_id)) return;

            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 });

            if (!latestMetrics || !latestMetrics.networkStats) {
                return res.json({});
            }

            return res.json(toPlainObject(latestMetrics.networkStats));
        }

        exec('cat /proc/net/dev', (err, stdout) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Error reading network statistics' });
                return;
            }

            const lines = stdout.split('\n');
            const stats = {};

            for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(/\s+/);
                const interfaceName = parts[0].replace(':', '');

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
};

export const getCpuPerCore = async (req, res) => {
    try {
        const hosted = isHostedEnvironment();

        if (hosted) {
            const { server_id } = req.query;

            if (!server_id) {
                return res.status(404).json({
                    error: 'No server selected',
                    hosted: true
                });
            }

            if (!validateObjectIdOrSend(res, server_id)) return;

            const latestMetrics = await Metrics.findOne({ server_id: server_id })
                .sort({ timestamp: -1 });

            if (!latestMetrics || !latestMetrics.cpus) {
                return res.status(404).json({ error: 'No CPU data available' });
            }

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

        exec('cat /proc/stat', (err, stdout) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Error reading CPU statistics' });
                return;
            }

            const lines = stdout.split('\n');
            const cpuData = [];

            for (const line of lines) {
                if (line.startsWith('cpu') && line !== lines[0]) {
                    const parts = line.split(/\s+/);
                    const cpuName = parts[0];

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
};
