import mongoose from 'mongoose';
import Server from '../models/Server.js';
import Metrics from '../models/Metrics.js';
import {
    authorizeServerAccess,
    findOwnerByRegCode,
    getCurrentUser,
    getRegistrationCodes,
    isAdminUser,
    isHostedEnvironment
} from './apiHelpers.js';

export const getServers = async (req, res) => {
    try {
        const { sort, limit, fields } = req.query;

        const hosted = isHostedEnvironment();
        const isAdmin = isAdminUser(req);
        const currentUser = await getCurrentUser(req);
        const userCode = currentUser?.registrationCode?.toUpperCase();
        const regCodes = getRegistrationCodes();

        let query = Server.find();

        if (sort) {
            query = query.sort(sort);
        } else {
            query = query.sort({ lastSeen: -1 });
        }

        if (limit) {
            query = query.limit(parseInt(limit));
        }

        if (fields) {
            query = query.select(fields.split(',').join(' '));
        }

        const servers = await query;

        let filteredServers = servers;
        if (!isAdmin) {
            if (hosted) {
                filteredServers = servers.filter(server => regCodes.get(server.identifier) === userCode);
            } else {
                filteredServers = servers.filter(server => {
                    const code = regCodes.get(server.identifier);
                    return !code || code === userCode;
                });
            }
        }

        const serversWithCounts = await Promise.all(
            filteredServers.map(async (server) => {
                const metricsCount = await Metrics.countDocuments({ server_id: server._id });
                const serverRegCode = regCodes.get(server.identifier);
                const owner = await findOwnerByRegCode(serverRegCode);

                return {
                    ...server.toObject(),
                    metricsCount,
                    dynamicOwner: owner ? {
                        username: owner.username,
                        fullName: owner.fullName
                    } : null
                };
            })
        );

        res.status(200).json(serversWithCounts);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getServerById = async (req, res) => {
    const { id } = req.params;

    try {
        let server;

        if (mongoose.Types.ObjectId.isValid(id)) {
            server = await Server.findById(id);
        }

        if (!server) {
            server = await Server.findOne({ identifier: id });
        }

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const hosted = isHostedEnvironment();
        const accessError = await authorizeServerAccess({ server, req, hosted });
        if (accessError) {
            return res.status(403).json({
                error: 'Access denied',
                message: accessError
            });
        }

        const metricsCount = await Metrics.countDocuments({ server_id: server._id });

        res.status(200).json({
            ...server.toObject(),
            metricsCount
        });
    } catch (error) {
        console.error('Error fetching server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createServer = async (req, res) => {
    const { hostname, username, arch, os_type, release, cpuModel, totalMemory } = req.body;

    if (!hostname || !username || !arch || !os_type || !release) {
        return res.status(400).json({
            error: 'Missing required fields. Required: hostname, username, arch, os_type, release'
        });
    }

    try {
        const identifier = `${username}@${hostname}`;

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
};

export const updateServer = async (req, res) => {
    const { id } = req.params;
    const { hostname, username, arch, os_type, release, cpuModel, totalMemory } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    const updateFields = {};
    if (hostname) updateFields.hostname = hostname;
    if (username) updateFields.username = username;
    if (arch) updateFields.arch = arch;
    if (os_type) updateFields.os_type = os_type;
    if (release) updateFields.release = release;
    if (cpuModel) updateFields.cpuModel = cpuModel;
    if (totalMemory !== undefined) updateFields.totalMemory = totalMemory;

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
};

export const deleteServer = async (req, res) => {
    const { id } = req.params;
    const { dryRun } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        const server = await Server.findById(id);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const metricsCount = await Metrics.countDocuments({ server_id: id });

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
};

export const claimServer = async (req, res) => {
    const { id } = req.params;

    console.log(`⚠ Old claim endpoint called for ${id} - ignoring (dynamic ownership active)`);

    res.status(200).json({
        message: 'Ownership is now dynamic - no claiming needed',
        success: true
    });
};

export const getServerMetrics = async (req, res) => {
    const { id } = req.params;
    const { limit, since } = req.query;

    try {
        let server;

        if (mongoose.Types.ObjectId.isValid(id)) {
            server = await Server.findById(id);
        } else {
            server = await Server.findOne({ identifier: id });
        }

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const hosted = isHostedEnvironment();
        const accessError = await authorizeServerAccess({ server, req, hosted });
        if (accessError) {
            return res.status(403).json({
                error: 'Access denied',
                message: accessError
            });
        }

        let query = Metrics.find({ server_id: server._id }).sort({ timestamp: -1 });

        if (since) {
            const sinceDate = new Date(Date.now() - parseInt(since) * 60 * 1000);
            query = query.where('timestamp').gte(sinceDate);
        }

        if (limit) {
            query = query.limit(parseInt(limit));
        } else {
            query = query.limit(100);
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
};
