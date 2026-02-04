// Machines page functionality
// Version: 2025-01-19-v4 (cache bust - plain text OS names)
console.log('machines.js loaded - version 2025-01-19-v4');

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
                                <i class="bi bi-pc-display-horizontal metric-icon"></i>
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
                            <button class="btn btn-sm btn-outline-secondary" onclick="openEditModal('${server._id}')">
                                <i class="bi bi-pencil me-1"></i>
                                Edit
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
window.viewMetrics = function(serverId) {
    // Redirect to home page with server_id parameter to view that specific server's metrics
    window.location.href = `/?server_id=${serverId}`;
}

// Delete a machine
window.deleteMachine = async function(serverId, identifier) {
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

            // Check if it's an authentication error
            if (response.status === 401) {
                alert('You must be logged in to perform this action. Redirecting to login page...');
                window.location.href = '/login';
            } else {
                alert('Error deleting machine: ' + error.error);
            }
        }
    } catch (error) {
        console.error('Error deleting machine:', error);
        alert('Error deleting machine. Please try again.');
    }
}

// Open create modal
window.openCreateModal = function() {
    console.log('openCreateModal called');

    // Check if Bootstrap is loaded
    if (typeof bootstrap === 'undefined') {
        alert('Bootstrap is not loaded yet. Please refresh the page.');
        return;
    }

    // Reset form
    document.getElementById('machineForm').reset();
    document.getElementById('machineId').value = '';
    document.getElementById('machineModalLabel').textContent = 'Add New Machine';

    // Open modal
    const modalElement = document.getElementById('machineModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// Open edit modal
window.openEditModal = async function(serverId) {
    console.log('openEditModal called with serverId:', serverId);

    // Check if Bootstrap is loaded
    if (typeof bootstrap === 'undefined') {
        alert('Bootstrap is not loaded yet. Please refresh the page.');
        return;
    }

    try {
        const response = await fetch(`/api/servers/${serverId}`);

        if (!response.ok) {
            alert('Error loading machine data');
            return;
        }

        const server = await response.json();

        // Populate form
        document.getElementById('machineId').value = server._id;
        document.getElementById('hostname').value = server.hostname;
        document.getElementById('username').value = server.username;
        document.getElementById('arch').value = server.arch;
        document.getElementById('os_type').value = server.os_type;
        document.getElementById('release').value = server.release;
        document.getElementById('cpuModel').value = server.cpuModel || '';

        // Convert memory from bytes to GB for display
        if (server.totalMemory) {
            document.getElementById('totalMemory').value = (server.totalMemory / 1024 / 1024 / 1024).toFixed(2);
        } else {
            document.getElementById('totalMemory').value = '';
        }

        document.getElementById('machineModalLabel').textContent = 'Edit Machine';

        // Open modal
        const modalElement = document.getElementById('machineModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error('Error loading machine data:', error);
        alert('Error loading machine data. Please try again.');
    }
}

// Save machine (create or update)
window.saveMachine = async function() {
    console.log('saveMachine called');

    const machineId = document.getElementById('machineId').value;
    const hostname = document.getElementById('hostname').value.trim();
    const username = document.getElementById('username').value.trim();
    const arch = document.getElementById('arch').value;
    const os_type = document.getElementById('os_type').value;
    const release = document.getElementById('release').value.trim();
    const cpuModel = document.getElementById('cpuModel').value.trim();
    const totalMemoryGB = document.getElementById('totalMemory').value;

    // Validate required fields
    if (!hostname || !username || !arch || !os_type || !release) {
        alert('Please fill in all required fields');
        return;
    }

    // Prepare data
    const data = {
        hostname,
        username,
        arch,
        os_type,
        release
    };

    // Add optional fields
    if (cpuModel) {
        data.cpuModel = cpuModel;
    }

    if (totalMemoryGB) {
        // Convert GB to bytes
        data.totalMemory = parseFloat(totalMemoryGB) * 1024 * 1024 * 1024;
    }

    try {
        let response;

        if (machineId) {
            // Update existing machine (PUT)
            response = await fetch(`/api/servers/${machineId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create new machine (POST)
            response = await fetch('/api/servers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }

        if (response.ok) {
            alert(machineId ? 'Machine updated successfully!' : 'Machine created successfully!');

            // Close modal
            const modalElement = document.getElementById('machineModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }

            // Reload machines list
            loadMachines();
        } else {
            const error = await response.json();

            // Check if it's an authentication error
            if (response.status === 401) {
                alert('You must be logged in to perform this action. Redirecting to login page...');
                window.location.href = '/login';
            } else {
                alert('Error: ' + error.error);
            }
        }
    } catch (error) {
        console.error('Error saving machine:', error);
        alert('Error saving machine. Please try again.');
    }
}

// Verify functions are globally accessible
console.log('Global functions registered:', {
    openCreateModal: typeof window.openCreateModal,
    openEditModal: typeof window.openEditModal,
    saveMachine: typeof window.saveMachine,
    viewMetrics: typeof window.viewMetrics,
    deleteMachine: typeof window.deleteMachine
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load machines on page load
    loadMachines();

    // Auto-refresh every 10 seconds
    setInterval(loadMachines, 10000);

    // Animation
    document.getElementById('machines-animated').classList.add('animate-in');
});
