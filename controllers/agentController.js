import Server from '../models/Server.js';
import Metrics from '../models/Metrics.js';
import { getRegistrationCodes } from './apiHelpers.js';

export const postAgentMetrics = async (req, res) => {
    try {
        const {
            cpuLoad, cpus, freeMem, totalMem, uptime, networkInterfaces, networkStats, diskUsage,
            hostname, username, arch, os_type, release, cpuModel, registrationCode
        } = req.body;

        if (!hostname || !username || !cpuLoad || freeMem === undefined || totalMem === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['hostname', 'username', 'cpuLoad', 'freeMem', 'totalMem']
            });
        }

        const identifier = `${username}@${hostname}`;
        const regCodes = getRegistrationCodes();

        if (registrationCode) {
            regCodes.set(identifier, registrationCode.toUpperCase());
            console.log(`✓ Server ${identifier} using registration code ${registrationCode}`);
        } else {
            regCodes.delete(identifier);
            console.log(`⚠ Server ${identifier} has no registration code (unclaimed)`);
        }

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
};
