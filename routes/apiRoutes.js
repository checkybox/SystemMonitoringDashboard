import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { postAgentMetrics } from '../controllers/agentController.js';
import {
    getEnvironment,
    getStaticStats,
    getStats,
    getOsRelease,
    getDiskUsage,
    getNetworkStats,
    getCpuPerCore
} from '../controllers/systemController.js';
import {
    getServers,
    getServerById,
    createServer,
    updateServer,
    deleteServer,
    claimServer,
    getServerMetrics
} from '../controllers/serversController.js';

const router = express.Router();


// Check if running in hosted mode (PROTECTED)
router.get('/environment', requireAuth, getEnvironment);

// POST endpoint for agents to push metrics
router.post('/agent-metrics', postAgentMetrics);


// Static system stats (PROTECTED)
router.get('/static-stats', requireAuth, getStaticStats);

// Dynamic system stats (saves to database with server association) (PROTECTED)
// In hosted mode, returns latest metrics from database instead of collecting locally
router.get('/stats', requireAuth, getStats);

// OS release information (PROTECTED)
router.get('/os-release', requireAuth, getOsRelease);

// Disk usage (PROTECTED)
router.get('/disk-usage', requireAuth, getDiskUsage);

// Network statistics from /proc/net/dev (PROTECTED)
router.get('/network-stats', requireAuth, getNetworkStats);

// Per-core CPU usage (PROTECTED)
router.get('/cpu-per-core', requireAuth, getCpuPerCore);

// ==================== CRUD API ROUTES FOR SERVERS ====================

// GET /api/servers - Return all servers with metrics count (PROTECTED)
router.get('/servers', requireAuth, getServers);

// GET /api/servers/:id - Return a single server by MongoDB _id or identifier (PROTECTED)
router.get('/servers/:id', requireAuth, getServerById);

// POST /api/servers - Create a new server manually (ADMIN ONLY)
router.post('/servers', requireAdmin, createServer);

// PUT /api/servers/:id - Update an existing server by MongoDB _id (ADMIN ONLY)
router.put('/servers/:id', requireAdmin, updateServer);

// DELETE /api/servers/:id - Delete a server by MongoDB _id (supports dry-run) (ADMIN ONLY)
router.delete('/servers/:id', requireAdmin, deleteServer);

// POST /api/servers/:id/claim - DEPRECATED: Stub for backward compatibility
router.post('/servers/:id/claim', requireAuth, claimServer);

// GET /api/servers/:id/metrics - Get metrics for a specific server (PROTECTED)
router.get('/servers/:id/metrics', requireAuth, getServerMetrics);

export default router;

