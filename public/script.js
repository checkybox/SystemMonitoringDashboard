// Global state variables - declared at top of file
const intervalIds = [];
let previousCpuStats = null;
let previousNetworkStats = null;
let lastNetworkStatsTime = null;
let bannerShown = false;
let bannerPromise = null;

// Get server_id from URL parameters (for viewing specific server metrics)
function getServerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('server_id');
}

function clearAllIntervals() {
    intervalIds.forEach(id => clearInterval(id));
    intervalIds.length = 0;
}

// Function for regular users to select a server from dropdown
async function selectServer() {
    const select = document.getElementById('server-select');
    const serverId = select.value;

    if (!serverId) {
        alert('Please select a machine from the dropdown');
        return;
    }

    // Direct reload with server_id (ownership is dynamic, no claiming needed)
    window.location.href = `/?server_id=${serverId}`;
}

async function loadStaticStats() {
    try {
        const serverId = getServerIdFromUrl();
        const url = serverId ? `/api/static-stats?server_id=${serverId}` : '/api/static-stats';
        const res = await fetch(url)

        if (!res.ok) {
            const error = await res.json();
            if (error.hosted || error.requiresSelection) {
                // Show waiting for agents message
                await showWaitingForAgents();
                return;
            }
            throw new Error(error.error || 'Failed to load static stats');
        }

        const data = await res.json()

        document.getElementById('username+hostname').textContent = data.userInfo.username + "@" + data.hostname
        document.getElementById('os+arch').textContent = data.type + " " + "(" + data.arch + ")"
        document.getElementById('kernel-version').textContent = data.release

        const cpuElement = document.getElementById('cpu-info')
        cpuElement.textContent = data.cpus[0].model
        cpuElement.title = data.cpus[0].model // Show full name on hover
    } catch (error) {
        console.error('Error loading static stats:', error);
    }
}

async function loadStats() {
    try {
        const serverId = getServerIdFromUrl();
        const url = serverId ? `/api/stats?server_id=${serverId}` : '/api/stats';
        const res = await fetch(url)

        if (!res.ok) {
            const error = await res.json();
            if (error.hosted || error.requiresSelection) {
                // Show waiting for agents message
                await showWaitingForAgents();
                return;
            }
            throw new Error(error.error || 'Failed to load stats');
        }

        const data = await res.json()

        const uptime_hours = Math.floor(data.uptime / 3600)
        const uptime_minutes = Math.floor((data.uptime % 3600) / 60)
        const uptime_seconds = Math.floor(data.uptime % 60)
        const formattedUptime = `${uptime_hours}h ${uptime_minutes}m ${uptime_seconds}s`

        const totalMemGB = (data.totalMem / 1024 / 1024 / 1024).toFixed(2)
        const freeMemGB = (data.freeMem / 1024 / 1024 / 1024).toFixed(2)
        const usedMemGB = (totalMemGB - freeMemGB).toFixed(2)

        document.getElementById('total-memory').textContent = totalMemGB + ' GB'
        document.getElementById('used-memory').textContent = usedMemGB + ' GB'
        document.getElementById('free-memory').textContent = freeMemGB + ' GB'
        document.getElementById('uptime').textContent = formattedUptime

        // Update load average
        const cpuLoad = data.cpuLoad;
        document.getElementById('load-1min').textContent = cpuLoad[0].toFixed(2)
        document.getElementById('load-5min').textContent = cpuLoad[1].toFixed(2)
        document.getElementById('load-15min').textContent = cpuLoad[2].toFixed(2)
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Show "waiting for agents" message when in hosted mode with no connected agents
async function showWaitingForAgents() {
    // If already shown, return immediately
    if (bannerShown) {
        return;
    }

    // If already processing, return the existing promise
    if (bannerPromise) {
        return bannerPromise;
    }

    // Check if banner already exists in DOM
    const existingBanner = document.getElementById('waiting-banner');
    if (existingBanner) {
        bannerShown = true;
        return;
    }

    // Create and store the promise
    bannerPromise = (async () => {
        const container = document.querySelector('.grid-stack');
        if (!container) return;

        // Stop all interval timers to prevent continuous calling
        clearAllIntervals();
        bannerShown = true;

        try {
            // Check how many servers are ONLINE (seen in last 2 minutes)
            const response = await fetch('/api/servers');
            const allServers = await response.json();

            // Filter to only online servers (seen within last 2 minutes)
            const now = new Date();
            const onlineServers = allServers.filter(server => {
                const lastSeen = new Date(server.lastSeen);
                const diffMinutes = Math.floor((now - lastSeen) / 60000);
                return diffMinutes < 2;
            });

            const banner = document.createElement('div');
            banner.id = 'waiting-banner';

            if (onlineServers.length === 0) {
                // No agents online
                banner.className = 'alert alert-warning text-center p-5 m-4';
                banner.innerHTML = `
                    <i class="bi bi-exclamation-triangle-fill fs-1 mb-3 d-block text-warning"></i>
                    <h3>Waiting for Agent Connection</h3>
                    <p class="mb-3">No monitoring agents are currently online.</p>
                    <p class="text-muted">To monitor your machines, please run the agent script on each machine you want to monitor.</p>
                    <p class="text-muted">The agent script is available in the repository. Check the README for setup instructions.</p>
                    <div class="mt-4">
                        <button class="btn btn-primary" onclick="location.reload()">
                            <i class="bi bi-arrow-clockwise me-2"></i>Refresh
                        </button>
                    </div>
                `;
            } else {
                // Agents are online but no server_id selected
                // Check user role to show appropriate options
                const authResponse = await fetch('/auth/check');
                const authData = await authResponse.json();
                const isAdmin = authData.isAuthenticated && authData.user?.role === 'admin';

                banner.className = 'alert alert-info text-center p-5 m-4';

                if (isAdmin) {
                    // Admin users: show link to Machines page
                    banner.innerHTML = `
                        <i class="bi bi-server fs-1 mb-3 d-block text-info"></i>
                        <h3>${onlineServers.length} Agent${onlineServers.length > 1 ? 's' : ''} Online</h3>
                        <p class="mb-3">Please select a machine to monitor from the Machines page.</p>
                        <div class="mt-4">
                            <a href="/machines" class="btn btn-primary">
                                <i class="bi bi-list-ul me-2"></i>View Machines
                            </a>
                        </div>
                    `;
                } else {
                    // Regular users: show dropdown to select server
                    let serverOptions = '';
                    onlineServers.forEach(server => {
                        serverOptions += `<option value="${server._id}">${server.identifier}</option>`;
                    });

                    banner.innerHTML = `
                        <i class="bi bi-server fs-1 mb-3 d-block text-info"></i>
                        <h3>${onlineServers.length} Agent${onlineServers.length > 1 ? 's' : ''} Online</h3>
                        <p class="mb-3">Please select a machine to monitor:</p>
                        <div class="mt-4">
                            <select id="server-select" class="form-select form-select-lg mb-3" style="max-width: 400px; margin: 0 auto;">
                                <option value="">Choose a machine...</option>
                                ${serverOptions}
                            </select>
                            <button class="btn btn-primary" onclick="selectServer()">
                                <i class="bi bi-check-circle me-2"></i>Monitor This Machine
                            </button>
                        </div>
                    `;
                }
            }

            container.parentElement.insertBefore(banner, container);
            container.style.display = 'none';
        } catch (error) {
            console.error('Error checking servers:', error);
            // Fallback banner
            const banner = document.createElement('div');
            banner.id = 'waiting-banner';
            banner.className = 'alert alert-warning text-center p-5 m-4';
            banner.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill fs-1 mb-3 d-block"></i>
                <h3>Loading...</h3>
                <p class="mb-3">Checking for connected agents...</p>
                <div class="mt-4">
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Refresh
                    </button>
                </div>
            `;
            container.parentElement.insertBefore(banner, container);
            container.style.display = 'none';
        }
    })();

    return bannerPromise;
}


async function loadCpuPerCore() {
    try {
        const serverId = getServerIdFromUrl();
        const url = serverId ? `/api/cpu-per-core?server_id=${serverId}` : '/api/cpu-per-core';
        const res = await fetch(url);
        const currentStats = await res.json();

        if (previousCpuStats) {
            displayCpuBars(currentStats, previousCpuStats);
        }

        previousCpuStats = currentStats;
    } catch (error) {
        console.error('Error loading CPU stats:', error);
        document.getElementById('cpu-bars-container').innerHTML = '<p class="text-muted">Error loading CPU data</p>';
    }
}

function displayCpuBars(currentStats, previousStats) {
    const container = document.getElementById('cpu-bars-container');

    if (!currentStats || currentStats.length === 0) {
        container.innerHTML = '<p class="text-muted">No CPU data available</p>';
        return;
    }

    // Calculate total CPU usage and per-core usages
    let totalUsage = 0;
    const usages = [];

    currentStats.forEach((current, index) => {
        const previous = previousStats[index];
        if (!previous) {
            usages.push(0);
            return;
        }

        // Calculate total time difference
        const prevTotal = Object.values(previous.times).reduce((a, b) => a + b, 0);
        const currTotal = Object.values(current.times).reduce((a, b) => a + b, 0);
        const totalDelta = currTotal - prevTotal;

        // Calculate idle time difference
        const idleDelta = current.times.idle - previous.times.idle;

        // Calculate usage percentage
        const usage = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
        usages.push(usage);
        totalUsage += usage;
    });

    const avgUsage = usages.length > 0 ? totalUsage / usages.length : 0;
    const avgUsagePercent = Math.min(100, Math.max(0, avgUsage)).toFixed(1);

    // Determine color for total usage bar
    let totalBarColor = 'bg-success';
    if (avgUsage > 80) {
        totalBarColor = 'bg-danger';
    } else if (avgUsage > 50) {
        totalBarColor = 'bg-warning';
    }

    // Check if we need to create the initial structure
    const needsInit = !container.querySelector('.cpu-bar-row');

    if (needsInit) {
        // Create total CPU usage bar at the top
        let html = `
            <div class="mb-3 pb-3 border-bottom">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold">Total CPU Load</span>
                    <span class="fw-bold cpu-total-percent">0.0%</span>
                </div>
                <div class="progress" style="height: 24px; border-radius: 12px;">
                    <div class="progress-bar cpu-total-bar bg-success" role="progressbar"
                         style="width: 0%; transition: width 0.8s ease-in-out, background-color 0.3s ease;"
                         aria-valuenow="0"
                         aria-valuemin="0"
                         aria-valuemax="100">
                    </div>
                </div>
            </div>
            <div class="row g-3">
        `;

        // Create columns with per-core bars
        // We want 3 columns with 4 CPUs each, filling columns first
        const numCols = 3;
        const numRows = Math.ceil(currentStats.length / numCols);

        // Create columns first
        for (let col = 0; col < numCols; col++) {
            html += '<div class="col-4">';

            // Fill each column with CPUs
            for (let row = 0; row < numRows; row++) {
                const cpuIndex = col * numRows + row;
                if (cpuIndex < currentStats.length) {
                    const current = currentStats[cpuIndex];
                    html += `
                        <div class="cpu-bar-row" data-cpu="${current.name}">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <small class="cpu-label">${current.name.toUpperCase()}</small>
                                <small class="cpu-percent">0.0%</small>
                            </div>
                            <div class="progress cpu-progress-bar">
                                <div class="progress-bar bg-success" role="progressbar" 
                                     style="width: 0%" 
                                     aria-valuenow="0" 
                                     aria-valuemin="0" 
                                     aria-valuemax="100">
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    // Update total CPU usage bar
    const totalPercentElement = container.querySelector('.cpu-total-percent');
    const totalBarElement = container.querySelector('.cpu-total-bar');

    if (totalPercentElement && totalBarElement) {
        totalPercentElement.textContent = `${avgUsagePercent}%`;
        totalBarElement.style.width = `${avgUsagePercent}%`;
        totalBarElement.setAttribute('aria-valuenow', avgUsagePercent);
        totalBarElement.classList.remove('bg-success', 'bg-warning', 'bg-danger');
        totalBarElement.classList.add(totalBarColor);
    }

    // Update existing per-core bars
    currentStats.forEach((current, index) => {
        const usage = usages[index];
        if (usage === undefined) return;

        const usagePercent = Math.min(100, Math.max(0, usage)).toFixed(1);

        // Determine color based on usage
        let barColor = 'bg-success'; // Green for low usage
        if (usage > 80) {
            barColor = 'bg-danger'; // Red for high usage
        } else if (usage > 50) {
            barColor = 'bg-warning'; // Yellow for medium usage
        }

        // Find the bar element
        const barRow = container.querySelector(`[data-cpu="${current.name}"]`);
        if (barRow) {
            // Update percentage text
            const percentElement = barRow.querySelector('.cpu-percent');
            if (percentElement) {
                percentElement.textContent = `${usagePercent}%`;
            }

            // Update progress bar
            const progressBar = barRow.querySelector('.progress-bar');
            if (progressBar) {
                // Update width (this will animate with CSS transition)
                progressBar.style.width = `${usagePercent}%`;
                progressBar.setAttribute('aria-valuenow', usagePercent);

                // Update color classes
                progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
                progressBar.classList.add(barColor);
            }
        }
    });
}

async function loadNetworkStats() {
    try {
        const serverId = getServerIdFromUrl();
        const url = serverId ? `/api/network-stats?server_id=${serverId}` : '/api/network-stats';
        const res = await fetch(url);
        const currentStats = await res.json();
        const currentTime = Date.now();

        displayNetworkStats(currentStats, currentTime);

        // Store current stats for next calculation
        previousNetworkStats = currentStats;
        lastNetworkStatsTime = currentTime;
    } catch (error) {
        console.error('Error loading network stats:', error);
        document.getElementById('network-interfaces').innerHTML = '<p class="text-muted">Error loading network statistics</p>';
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function displayNetworkStats(currentStats, currentTime) {
    const container = document.getElementById('network-interfaces');

    if (!currentStats || Object.keys(currentStats).length === 0) {
        container.innerHTML = '<p class="text-muted">No network interfaces found</p>';
        return;
    }

    let html = '';

    for (const [interfaceName, stats] of Object.entries(currentStats)) {
        // Calculate speeds if we have previous data
        let rxSpeed = 0;
        let txSpeed = 0;

        if (previousNetworkStats && previousNetworkStats[interfaceName] && lastNetworkStatsTime) {
            const timeDiff = (currentTime - lastNetworkStatsTime) / 1000; // seconds
            const rxDiff = stats.rxBytes - previousNetworkStats[interfaceName].rxBytes;
            const txDiff = stats.txBytes - previousNetworkStats[interfaceName].txBytes;

            rxSpeed = rxDiff / timeDiff;
            txSpeed = txDiff / timeDiff;
        }

        html += `
            <div class="mb-4 pb-3 border-bottom">
                <h6 class="fw-bold mb-3">
                    <i class="bi bi-ethernet me-2"></i>${interfaceName}
                </h6>
                <div class="row">
                    <div class="col-12 col-md-6">
                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-download metric-icon"></i>
                                Download
                            </span>
                            <span class="metric-value">${formatBytes(rxSpeed)}/s</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-arrow-down-circle metric-icon"></i>
                                Total RX
                            </span>
                            <span class="metric-value">${formatBytes(stats.rxBytes)}</span>
                        </div>
                    </div>
                    <div class="col-12 col-md-6">
                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-upload metric-icon"></i>
                                Upload
                            </span>
                            <span class="metric-value">${formatBytes(txSpeed)}/s</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-arrow-up-circle metric-icon"></i>
                                Total TX
                            </span>
                            <span class="metric-value">${formatBytes(stats.txBytes)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}


async function getOsRelease() {
    const res = await fetch('/api/os-release')
    const data = await res.text()
    console.log(data)
}

async function getDiskUsage() {
    const serverId = getServerIdFromUrl();
    const url = serverId ? `/api/disk-usage?server_id=${serverId}` : '/api/disk-usage';
    const res = await fetch(url)
    const data = await res.text()

    // split on newlines, trim each line, remove empty lines
    const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)

    // for indices 0 and 1 of "lines", split each element by whitespace and put them into new arrays
    const diskHeader = lines[0] ? lines[0].split(/\s+/) : []
    const diskBody = lines[1] ? lines[1].split(/\s+/) : []

    // store for later use and return
    console.log({ raw: data, lines, diskHeader, diskBody })

    // Populate individual disk metrics
    document.getElementById('disk-size').textContent = diskBody[1] || 'N/A'
    document.getElementById('disk-used').textContent = diskBody[2] || 'N/A'
    document.getElementById('disk-available').textContent = diskBody[3] || 'N/A'
    document.getElementById('disk-usage-percent').textContent = diskBody[4] || 'N/A'
}

// Machine switcher functions
async function initMachineSwitcher() {
    const serverId = getServerIdFromUrl();

    try {
        // Check user role first
        const authResponse = await fetch('/auth/check');
        const authData = await authResponse.json();
        const isAdmin = authData.isAuthenticated && authData.user?.role === 'admin';

        // Only show switcher for regular users
        if (isAdmin) {
            // Hide switcher for admins
            document.getElementById('machine-selector-nav').style.display = 'none';
            document.getElementById('clear-selection-nav').style.display = 'none';
            return;
        }

        if (!serverId) {
            // No server selected, hide switcher
            document.getElementById('machine-selector-nav').style.display = 'none';
            document.getElementById('clear-selection-nav').style.display = 'none';
            return;
        }

        // Fetch all servers
        const response = await fetch('/api/servers');
        const servers = await response.json();

        // Filter to online servers only (seen in last 2 minutes)
        const now = new Date();
        const onlineServers = servers.filter(server => {
            const lastSeen = new Date(server.lastSeen);
            const diffMinutes = Math.floor((now - lastSeen) / 60000);
            return diffMinutes < 2;
        });

        if (onlineServers.length > 0) {
            // Show machine selector in navbar (regular users only)
            document.getElementById('machine-selector-nav').style.display = 'block';
            document.getElementById('clear-selection-nav').style.display = 'block';

            // Populate dropdown
            const select = document.getElementById('machine-switcher');
            select.innerHTML = '';

            onlineServers.forEach(server => {
                const option = document.createElement('option');
                option.value = server._id;
                option.textContent = server.identifier;
                if (server._id === serverId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading machines for switcher:', error);
    }
}

function switchMachine() {
    const select = document.getElementById('machine-switcher');
    const serverId = select.value;
    if (serverId) {
        window.location.href = `/?server_id=${serverId}`;
    }
}

function clearMachineSelection() {
    window.location.href = '/';
}

loadStaticStats()
loadStats()
getOsRelease()
getDiskUsage()
loadNetworkStats()
loadCpuPerCore()
initMachineSwitcher() // Initialize machine switcher

// Start intervals - they will be cleared if banner needs to be shown
intervalIds.push(setInterval(loadStats, 1000)); // auto-refresh every 1 second
intervalIds.push(setInterval(loadNetworkStats, 1000)); // update network stats every 1 second
intervalIds.push(setInterval(loadCpuPerCore, 1000)); // update CPU per-core stats every 1 second

// Initialize Bootstrap tooltips
document.addEventListener('DOMContentLoaded', function() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
})
