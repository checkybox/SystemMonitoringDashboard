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

// Configuration
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const PUSH_INTERVAL = parseInt(process.env.PUSH_INTERVAL || '30') * 1000; // Convert to milliseconds

// Helper function to normalize OS type
function normalizeOSType(osType) {
    const osMap = {
        'Darwin': 'macOS',
        'Windows_NT': 'Windows',
        'Linux': 'Linux'
    };
    return osMap[osType] || osType;
}

// Collect system metrics
function collectMetrics() {
    const allInterfaces = os.networkInterfaces();

    // Filter interfaces by name (enp, tailscale, wlan, eth, en)
    const filteredInterfaces = {};
    Object.keys(allInterfaces).forEach(name => {
        if (name.includes('enp') ||
            name.includes('tailscale') ||
            name.includes('wlan') ||
            name.includes('eth') ||
            name.match(/^en\d+$/)) {
            filteredInterfaces[name] = allInterfaces[name];
        }
    });

    return {
        cpuLoad: os.loadavg(),
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        uptime: os.uptime(),
        networkInterfaces: filteredInterfaces,
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
    const metrics = collectMetrics();
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
