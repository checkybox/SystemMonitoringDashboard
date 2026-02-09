// Check authentication status and update UI
async function checkAuth() {
    try {
        const response = await fetch('/auth/check');
        const data = await response.json();

        updateNavigation(data.isAuthenticated, data.user);
    } catch (error) {
        console.error('Error checking auth:', error);
    }
}

// Update navigation based on authentication status
function updateNavigation(isAuthenticated, user) {
    // Select the navbar with ms-auto (the main navigation)
    const navbarNav = document.querySelector('.navbar-nav.ms-auto');

    // Remove existing auth items
    const existingAuthItems = document.querySelectorAll('.auth-item');
    existingAuthItems.forEach(item => item.remove());

    if (isAuthenticated && user) {
        // Hide/show navigation items based on role
        const machinesLink = document.querySelector('a[href="/machines"]');
        const settingsLink = document.querySelector('a[href="/settings"]');

        if (user.role !== 'admin') {
            // Hide admin-only pages for regular users
            if (machinesLink && machinesLink.parentElement) {
                machinesLink.parentElement.style.display = 'none';
            }
            // SHOW Settings for regular users
            if (settingsLink && settingsLink.parentElement) {
                settingsLink.parentElement.style.display = 'block';
            }
        } else {
            // Show all links for admins
            if (machinesLink && machinesLink.parentElement) {
                machinesLink.parentElement.style.display = '';
            }
            if (settingsLink && settingsLink.parentElement) {
                settingsLink.parentElement.style.display = '';
            }
        }

        // Add user info and logout button
        const userItem = document.createElement('li');
        userItem.className = 'nav-item auth-item dropdown';

        const rolebadge = user.role === 'admin'
            ? '<span class="badge bg-danger ms-1">Admin</span>'
            : '<span class="badge bg-secondary ms-1">User</span>';

        userItem.innerHTML = `
            <a class="nav-link fw-light dropdown-toggle" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-person-circle me-1"></i>
                ${user.username}
                ${rolebadge}
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                <li><span class="dropdown-item-text"><strong>${user.fullName}</strong></span></li>
                <li><span class="dropdown-item-text text-muted small">${user.email}</span></li>
                <li><span class="dropdown-item-text text-muted small">Role: ${user.role}</span></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="/settings"><i class="bi bi-gear-fill me-2"></i>Settings</a></li>
                <li><a class="dropdown-item" href="#" onclick="logout(event)"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
            </ul>
        `;

        // Insert at the BEGINNING (left side) of the navbar
        if (navbarNav.firstChild) {
            navbarNav.insertBefore(userItem, navbarNav.firstChild);
        } else {
            navbarNav.appendChild(userItem);
        }
    } else {
        // Add login button
        const loginItem = document.createElement('li');
        loginItem.className = 'nav-item auth-item';
        loginItem.innerHTML = `
            <a class="nav-link fw-light" href="/login">
                <i class="bi bi-box-arrow-in-right me-1"></i>
                Login
            </a>
        `;

        // Insert at the BEGINNING (left side) of the navbar
        if (navbarNav.firstChild) {
            navbarNav.insertBefore(loginItem, navbarNav.firstChild);
        } else {
            navbarNav.appendChild(loginItem);
        }
    }
}

// Logout function
async function logout(event) {
    if (event) {
        event.preventDefault();
    }

    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            // Redirect to home page
            window.location.href = '/';
        } else {
            console.error('Logout failed');
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('An error occurred during logout.');
    }
}

// Check auth on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}
