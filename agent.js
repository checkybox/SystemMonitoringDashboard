#!/usr/bin/env node

/**
 * System Monitoring Dashboard - Agent Script
 *
 * This lightweight agent collects system metrics from your machine
 * and pushes them to the hosted dashboard instance.
 *
 * Usage:
 *   node agent.js
 *
 * Environment Variables:
 *   DASHBOARD_URL - The URL of your hosted dashboard (required)
 *                   Example: https://your-app.onrender.com
 *   PUSH_INTERVAL - How often to push metrics in seconds (default: 30)
 */

import os from 'os';
import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://systemmonitoringdashboard-d1bh.onrender.com/';
const PUSH_INTERVAL = parseInt(process.env.PUSH_INTERVAL || '1') * 1000; // Convert to milliseconds

// Helper function to normalize OS type
function normalizeOSType(osType) {
    const osMap = {
        'Darwin': 'macOS',
        'Windows_NT': 'Windows',
        'Linux': 'Linux'
    };
    return osMap[osType] || osType;
}

// Collect disk usage information
async function getDiskUsage() {
    try {
        const { stdout } = await execAsync('df -h / | tail -n 1');
        const parts = stdout.trim().split(/\s+/);

        if (parts.length >= 5) {
            return {
                filesystem: parts[0],
                size: parts[1],
                used: parts[2],
                available: parts[3],
                usePercent: parts[4],
                mountPoint: parts[5] || '/'
            };
        }
    } catch (error) {
        console.error('Error getting disk usage:', error.message);
    }

    return null;
}

// Collect network statistics from /proc/net/dev
async function getNetworkStats() {
    try {
        const { stdout } = await execAsync('cat /proc/net/dev');
        const lines = stdout.split('\n');
        const stats = {};

        // Skip first 2 header lines
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(/\s+/);
            const interfaceName = parts[0].replace(':', '');

            // Filter for physical and useful interfaces only
            // Exclude: lo (loopback), veth* (docker), docker*, virbr* (libvirt), br-* (bridges)
            const isVirtualInterface =
                interfaceName === 'lo' ||
                interfaceName.startsWith('veth') ||
                interfaceName.startsWith('docker') ||
                interfaceName.startsWith('virbr') ||
                interfaceName.startsWith('br-') ||
                interfaceName.startsWith('vnet');

            if (isVirtualInterface) {
                continue; // Skip this interface
            }

            // Include physical/useful interfaces
            if (interfaceName.includes('enp') ||
                interfaceName.includes('tailscale') ||
                interfaceName.includes('wlan') ||
                interfaceName.includes('eth') ||
                interfaceName.startsWith('wl') ||
                interfaceName.match(/^en[ops]\d+/)) {
                stats[interfaceName] = {
                    rxBytes: parseInt(parts[1]) || 0,
                    rxPackets: parseInt(parts[2]) || 0,
                    txBytes: parseInt(parts[9]) || 0,
                    txPackets: parseInt(parts[10]) || 0
                };
            }
        }

        return stats;
    } catch (error) {
        console.error('Error getting network stats:', error.message);
        return {};
    }
}

// Collect system metrics
async function collectMetrics() {
    const allInterfaces = os.networkInterfaces();

    // Filter interfaces - exclude virtual/unwanted interfaces
    const filteredInterfaces = {};
    Object.keys(allInterfaces).forEach(name => {
        // Skip virtual interfaces
        const isVirtualInterface =
            name === 'lo' ||
            name.startsWith('veth') ||
            name.startsWith('docker') ||
            name.startsWith('virbr') ||
            name.startsWith('br-') ||
            name.startsWith('vnet');

        if (isVirtualInterface) {
            return; // Skip this interface
        }

        // Include physical/useful interfaces
        if (name.includes('enp') ||
            name.includes('tailscale') ||
            name.includes('wlan') ||
            name.includes('eth') ||
            name.startsWith('wl') ||
            name.match(/^en[ops]\d+/) ||
            name.match(/^en\d+$/)) {
            filteredInterfaces[name] = allInterfaces[name];
        }
    });

    // Get disk usage
    const diskUsage = await getDiskUsage();

    // Get network statistics
    const networkStats = await getNetworkStats();

    return {
        cpuLoad: os.loadavg(),
        cpus: os.cpus(), // Send full CPU info including per-core times
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        uptime: os.uptime(),
        networkInterfaces: filteredInterfaces,
        networkStats: networkStats, // RX/TX bytes for each interface
        diskUsage: diskUsage,
        hostname: os.hostname(),
        username: os.userInfo().username,
        arch: os.arch(),
        os_type: normalizeOSType(os.type()),
        release: os.release(),
        cpuModel: os.cpus()[0]?.model || 'Unknown',
    };
}

// Push metrics to the dashboard
async function pushMetrics() {
    const metrics = await collectMetrics();
    const data = JSON.stringify(metrics);

    const url = new URL(DASHBOARD_URL);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: '/api/agent-metrics',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    return new Promise((resolve, reject) => {
        const req = protocol.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`[${new Date().toISOString()}] ✓ Metrics pushed successfully (${metrics.username}@${metrics.hostname})`);
                    resolve(responseData);
                } else {
                    console.error(`[${new Date().toISOString()}] ✗ Failed to push metrics: ${res.statusCode} ${res.statusMessage}`);
                    console.error(`   Response: ${responseData}`);
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error(`[${new Date().toISOString()}] ✗ Network error:`, error.message);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// Main function
async function main() {
    console.log('='.repeat(60));
    console.log('System Monitoring Dashboard - Agent');
    console.log('='.repeat(60));
    console.log(`Dashboard URL: ${DASHBOARD_URL}`);
    console.log(`Push Interval: ${PUSH_INTERVAL / 1000} seconds`);
    console.log(`Machine: ${os.userInfo().username}@${os.hostname()}`);
    console.log('='.repeat(60));
    console.log('');

    // Validate configuration
    if (!DASHBOARD_URL) {
        console.error('ERROR: DASHBOARD_URL environment variable is not set.');
        console.error('Usage: DASHBOARD_URL=https://your-app.onrender.com node agent.js');
        process.exit(1);
    }

    // Initial push
    console.log('Starting agent...');
    try {
        await pushMetrics();
    } catch (error) {
        console.error('Initial metrics push failed. Will retry in', PUSH_INTERVAL / 1000, 'seconds...');
    }

    // Schedule regular pushes
    setInterval(async () => {
        try {
            await pushMetrics();
        } catch (error) {
            // Error already logged in pushMetrics
        }
    }, PUSH_INTERVAL);

    console.log('Agent is running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down agent...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\nShutting down agent...');
    process.exit(0);
});

// Run the agent
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
