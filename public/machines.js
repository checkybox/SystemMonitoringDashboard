// Machines page functionality

// Load all machines from API
async function loadMachines() {
    try {
        const response = await fetch('/api/servers');
        const servers = await response.json();

        const container = document.getElementById('machines-container');

        if (servers.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No machines found. Machines are automatically registered when they connect to the dashboard.
                </div>
            `;
            return;
        }

        let html = '<div class="row g-4">';

        servers.forEach(server => {
            const lastSeen = new Date(server.lastSeen);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSeen) / 60000);
            const isOnline = diffMinutes < 2; // Online if seen in last 2 minutes

            // Debug logging
            console.log(`Server: ${server.identifier}, Last Seen: ${lastSeen}, Diff: ${diffMinutes}m, Online: ${isOnline}`);

            const statusBadge = isOnline
                ? '<span class="badge bg-success">Online</span>'
                : `<span class="badge bg-secondary">Offline (${diffMinutes}m ago)</span>`;

            const memoryGB = (server.totalMemory / 1024 / 1024 / 1024).toFixed(2);

            html += `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card-floating h-100">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <h5 class="card-header-custom mb-0">
                                <i class="bi bi-pc-display me-2"></i>
                                ${server.identifier}
                            </h5>
                            ${statusBadge}
                        </div>

                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-ubuntu metric-icon"></i>
                                OS
                            </span>
                            <span class="metric-value">${server.os_type}</span>
                        </div>

                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-gear-fill metric-icon"></i>
                                Kernel
                            </span>
                            <span class="metric-value">${server.release}</span>
                        </div>

                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-cpu metric-icon"></i>
                                CPU
                            </span>
                            <span class="metric-value">${server.cpuModel || 'Unknown'}</span>
                        </div>

                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-memory metric-icon"></i>
                                Memory
                            </span>
                            <span class="metric-value">${memoryGB} GB</span>
                        </div>

                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-clock-history metric-icon"></i>
                                Last Seen
                            </span>
                            <span class="metric-value">${lastSeen.toLocaleString()}</span>
                        </div>

                        <div class="metric-row">
                            <span class="metric-label">
                                <i class="bi bi-bar-chart metric-icon"></i>
                                Metrics Stored
                            </span>
                            <span class="metric-value">${server.metricsCount || 0}</span>
                        </div>

                        <div class="mt-3 d-flex gap-2">
                            <button class="btn btn-sm btn-primary" onclick="viewMetrics('${server._id}')">
                                <i class="bi bi-graph-up me-1"></i>
                                View Metrics
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteMachine('${server._id}', '${server.identifier}')">
                                <i class="bi bi-trash me-1"></i>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading machines:', error);
        document.getElementById('machines-container').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error loading machines. Please try again later.
            </div>
        `;
    }
}

// View metrics for a specific server
function viewMetrics(serverId) {
    window.location.href = `/api/servers/${serverId}/metrics`;
}

// Delete a machine
async function deleteMachine(serverId, identifier) {
    if (!confirm(`Are you sure you want to delete ${identifier}? This will also delete all associated metrics.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/servers/${serverId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Machine deleted successfully');
            loadMachines(); // Reload the list
        } else {
            const error = await response.json();
            alert('Error deleting machine: ' + error.error);
        }
    } catch (error) {
        console.error('Error deleting machine:', error);
        alert('Error deleting machine. Please try again.');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load machines on page load
    loadMachines();

    // Auto-refresh every 10 seconds
    setInterval(loadMachines, 10000);

    // Animation
    document.getElementById('machines-animated').classList.add('animate-in');
});
