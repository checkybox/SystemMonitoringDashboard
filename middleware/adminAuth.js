// Role-based authorization middleware

// Middleware to check if user has admin role
export const requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        // Not authenticated
        if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        return res.redirect('/login');
    }

    // Check if user is admin
    if (req.session.user && req.session.user.role === 'admin') {
        return next(); // User is admin, allow access
    }

    // User is authenticated but not admin
    if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin privileges required for this action'
        });
    }

    // For page requests, redirect to home with error
    return res.redirect('/?error=admin_required');
};

// Middleware to check user role and allow only their own data access
export const requireSelfOrAdmin = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        return res.redirect('/login');
    }

    // Admins can access anything
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }

    // Regular users can only access their own data
    // This will be used in combination with filtering in route handlers
    req.userRole = req.session.user.role;
    req.currentUserId = req.session.userId;
    next();
};
