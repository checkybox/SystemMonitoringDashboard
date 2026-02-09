// Get server_id from URL parameters (for viewing specific server metrics)
function getServerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('server_id');
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

// Flag to track if banner is already shown
let bannerShown = false;
// Store the promise to ensure only one execution
let bannerPromise = null;

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
            const templates = await ensureTemplates();
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
                banner.className = 'alert alert-warning text-center p-5 m-4';
                banner.innerHTML = templates.waitNone;
            } else {
                // Agents are online but no server_id selected
                // Check user role to show appropriate options
                const authResponse = await fetch('/auth/check');
                const authData = await authResponse.json();
                const isAdmin = authData.isAuthenticated && authData.user?.role === 'admin';

                banner.className = 'alert alert-info text-center p-5 m-4';

                if (isAdmin) {
                    banner.innerHTML = renderTpl(templates.waitAdmin, {
                        onlineCount: onlineServers.length,
                        pluralS: onlineServers.length > 1 ? 's' : ''
                    });
                } else {
                    let serverOptions = '';
                    onlineServers.forEach(server => {
                        serverOptions += `<option value="${server._id}">${server.identifier}</option>`;
                    });

                    banner.innerHTML = renderTpl(templates.waitUser, {
                        onlineCount: onlineServers.length,
                        pluralS: onlineServers.length > 1 ? 's' : '',
                        options: serverOptions
                    });
                }
            }

            container.parentElement.insertBefore(banner, container);
            container.style.display = 'none';
        } catch (error) {
            console.error('Error checking servers:', error);
            const templates = await ensureTemplates();
            const banner = document.createElement('div');
            banner.id = 'waiting-banner';
            banner.className = 'alert alert-warning text-center p-5 m-4';
            banner.innerHTML = templates.waitFallback;
            container.parentElement.insertBefore(banner, container);
            container.style.display = 'none';
        }
    })();

    return bannerPromise;
}

// Template helpers for loading HTML partials from /public/templates
const tplCache = {};
async function loadTpl(name) {
    if (tplCache[name]) return tplCache[name];
    const res = await fetch(`/templates/${name}.html`);
    if (!res.ok) throw new Error(`Failed to load template: ${name}`);
    const text = await res.text();
    tplCache[name] = text;
    return text;
}
function renderTpl(tpl, data = {}) {
    return Object.entries(data).reduce((out, [key, val]) => {
        const safeVal = val === undefined || val === null ? '' : val;
        return out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), safeVal);
    }, tpl);
}

// Preload templates used on this page
let templatesPromise = null;
function ensureTemplates() {
    if (!templatesPromise) {
        templatesPromise = Promise.all([
            loadTpl('cpu-total'),
            loadTpl('cpu-core'),
            loadTpl('network-interface'),
            loadTpl('waiting-no-agents'),
            loadTpl('waiting-admin'),
            loadTpl('waiting-user'),
            loadTpl('waiting-fallback')
        ]).then(([cpuTotal, cpuCore, netIface, waitNone, waitAdmin, waitUser, waitFallback]) => ({
            cpuTotal,
            cpuCore,
            netIface,
            waitNone,
            waitAdmin,
            waitUser,
            waitFallback
        }));
    }
    return templatesPromise;
}

async function loadCpuPerCore() {
    try {
        const serverId = getServerIdFromUrl();
        const url = serverId ? `/api/cpu-per-core?server_id=${serverId}` : '/api/cpu-per-core';
        const res = await fetch(url);
        const currentStats = await res.json();

        if (previousCpuStats) {
            await displayCpuBars(currentStats, previousCpuStats);
        }

        previousCpuStats = currentStats;
    } catch (error) {
        console.error('Error loading CPU stats:', error);
        document.getElementById('cpu-bars-container').innerHTML = '<p class="text-muted">Error loading CPU data</p>';
    }
}

async function displayCpuBars(currentStats, previousStats) {
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
        const templates = await ensureTemplates();
        // Create total CPU usage bar at the top
        let html = renderTpl(templates.cpuTotal, {});
        html += '<div class="row g-3">';

        // Create columns with per-core bars
        const numCols = 3;
        const numRows = Math.ceil(currentStats.length / numCols);

        for (let col = 0; col < numCols; col++) {
            html += '<div class="col-4">';

            for (let row = 0; row < numRows; row++) {
                const cpuIndex = col * numRows + row;
                if (cpuIndex < currentStats.length) {
                    const current = currentStats[cpuIndex];
                    html += renderTpl(templates.cpuCore, {
                        cpuName: current.name,
                        cpuLabel: current.name.toUpperCase()
                    });
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

        await displayNetworkStats(currentStats, currentTime);

        // Store current stats for next calculation
        previousNetworkStats = currentStats;
        lastNetworkStatsTime = currentTime;
    } catch (error) {
        console.error('Error loading network stats:', error);
        document.getElementById('network-interfaces').innerHTML = '<p class="text-muted">Error loading network statistics</p>';
    }
}

async function displayNetworkStats(currentStats, currentTime) {
    const container = document.getElementById('network-interfaces');

    if (!currentStats || Object.keys(currentStats).length === 0) {
        container.innerHTML = '<p class="text-muted">No network interfaces found</p>';
        return;
    }

    let html = '';
    const templates = await ensureTemplates();

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

        html += renderTpl(templates.netIface, {
            interfaceName,
            rxSpeed: formatBytes(rxSpeed) + '/s',
            rxBytes: formatBytes(stats.rxBytes),
            txSpeed: formatBytes(txSpeed) + '/s',
            txBytes: formatBytes(stats.txBytes)
        });
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
