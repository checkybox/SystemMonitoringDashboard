import os from 'os';
import mongoose from 'mongoose';

/**
 * Helper function to normalize OS type to plain text
 */
export function normalizeOSType(osType) {
    const osMap = {
        'Darwin': 'macOS',
        'Windows_NT': 'Windows',
        'Linux': 'Linux'
    };
    return osMap[osType] || osType;
}

/**
 * Helper function to check if we're running in hosted environment (not localhost)
 */
export function isHostedEnvironment() {
    const hostname = os.hostname();
    // Check if we're on Render or similar hosting platforms
    return process.env.RENDER ||
           process.env.RAILWAY_ENVIRONMENT ||
           process.env.VERCEL ||
           hostname.includes('render') ||
           hostname.includes('railway') ||
           hostname.includes('vercel');
}

/**
 * Get registration codes storage (runtime memory)
 */
export function getRegistrationCodes() {
    if (!global.serverRegistrationCodes) {
        global.serverRegistrationCodes = new Map();
    }
    return global.serverRegistrationCodes;
}

/**
 * Validate MongoDB ObjectId and send error response if invalid
 * @returns {boolean} true if valid, false if invalid (response already sent)
 */
export function validateObjectIdOrSend(res, id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid server_id' });
        return false;
    }
    return true;
}

/**
 * Convert Mongoose Map to plain object
 */
export function toPlainObject(data) {
    if (data instanceof Map) {
        const obj = {};
        data.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }
    return data;
}

/**
 * Check server ownership/access for regular users
 * Returns error message if access denied, null if allowed
 */
export async function authorizeServerAccess({ server, req, hosted }) {
    const isAdmin = req.session.user && req.session.user.role === 'admin';
    if (isAdmin) return null; // Admins have access to everything

    const userId = req.session.userId;
    const User = mongoose.model('User');
    const regCodes = getRegistrationCodes();

    const currentUser = await User.findById(userId);
    const serverRegCode = regCodes.get(server.identifier);

    if (hosted) {
        // Hosted: strict - must match user's registration code
        if (!currentUser || !currentUser.registrationCode) {
            return 'You need a registration code to access servers';
        }
        if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
            return 'You can only access your own servers';
        }
    } else {
        // Localhost: allow if unclaimed OR matches user's code
        if (serverRegCode && currentUser && currentUser.registrationCode) {
            if (serverRegCode !== currentUser.registrationCode.toUpperCase()) {
                return 'You can only access your own servers';
            }
        }
    }

    return null; // Access granted
}

