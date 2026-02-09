// Machines page functionality
// Version: 2025-01-19-v4 (cache bust - plain text OS names)
console.log('machines.js loaded - version 2025-01-19-v4');

// Template helpers
const templateCache = {};
async function loadTemplate(name) {
    if (templateCache[name]) return templateCache[name];
    const res = await fetch(`/templates/${name}.html`);
    if (!res.ok) throw new Error(`Failed to load template: ${name}`);
    const text = await res.text();
    templateCache[name] = text;
    return text;
}
function renderTemplate(template, data = {}) {
    return Object.entries(data).reduce((html, [key, value]) => {
        return html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value ?? '');
    }, template);
}

// Shared fetch helper with basic auth handling
async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        alert('You must be logged in to perform this action. Redirecting to login page...');
        window.location.href = '/login';
        return null;
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Request failed');
    }
    return response.json();
}

// Preload templates used on this page
let machineTemplatesPromise = null;
function ensureMachineTemplates() {
    if (!machineTemplatesPromise) {
        machineTemplatesPromise = Promise.all([
            loadTemplate('machine-card'),
            loadTemplate('machines-empty')
        ]).then(([card, empty]) => ({ card, empty }));
    }
    return machineTemplatesPromise;
}

// Load all machines from API
async function loadMachines() {
    try {
        const servers = await fetchJson('/api/servers');
        if (!servers) return;

        const { card: cardTpl, empty: emptyTpl } = await ensureMachineTemplates();
        const container = document.getElementById('machines-container');

        if (servers.length === 0) {
            container.innerHTML = emptyTpl;
            return;
        }

        let html = '<div class="row g-4">';

        servers.forEach(server => {
            const lastSeen = new Date(server.lastSeen);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSeen) / 60000);
            const isOnline = diffMinutes < 2; // Online if seen in last 2 minutes

            const statusBadge = isOnline
                ? '<span class="badge bg-success">Online</span>'
                : `<span class="badge bg-secondary">Offline (${diffMinutes}m ago)</span>`;

            const memoryGB = (server.totalMemory / 1024 / 1024 / 1024).toFixed(2);

            html += renderTemplate(cardTpl, {
                serverId: server._id,
                identifier: server.identifier,
                statusBadge,
                os_type: server.os_type,
                release: server.release,
                cpuModel: server.cpuModel || 'Unknown',
                memoryGB,
                lastSeen: lastSeen.toLocaleString(),
                metricsCount: server.metricsCount || 0
            });
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
        await fetchJson(`/api/servers/${serverId}`, { method: 'DELETE' });
        alert('Machine deleted successfully');
        loadMachines();
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
        const server = await fetchJson(`/api/servers/${serverId}`);
        if (!server) return;

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
        const options = {
            method: machineId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };

        await fetchJson(machineId ? `/api/servers/${machineId}` : '/api/servers', options);

        alert(machineId ? 'Machine updated successfully!' : 'Machine created successfully!');

        // Close modal
        const modalElement = document.getElementById('machineModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }

        loadMachines();
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
