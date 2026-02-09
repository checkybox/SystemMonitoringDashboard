// Authentication middleware to check if user is logged in
export const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        // User is authenticated
        return next();
    }

    // User is not authenticated
    // Check if this is an API request or page request
    if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json')) {
        // For API requests, return JSON error
        return res.status(401).json({
            error: 'Authentication required',
            message: 'You must be logged in to perform this action'
        });
    }

    // For page requests, redirect to login
    return res.redirect('/login');
};

// Middleware to check if user is already logged in (for login/register pages)
export const requireGuest = (req, res, next) => {
    if (req.session && req.session.userId) {
        // User is already logged in, redirect to home
        return res.redirect('/');
    }
    next();
};

// Middleware to add user info to all views
export const addUserToLocals = (req, res, next) => {
    res.locals.isAuthenticated = !!(req.session && req.session.userId);
    res.locals.user = req.session?.user || null;
    next();
};
