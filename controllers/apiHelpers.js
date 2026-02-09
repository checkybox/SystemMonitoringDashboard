import os from 'os';
import mongoose from 'mongoose';
import User from '../models/User.js';

export function normalizeOSType(osType) {
    const osMap = {
        'Darwin': 'macOS',
        'Windows_NT': 'Windows',
        'Linux': 'Linux'
    };
    return osMap[osType] || osType;
}

export const getRegistrationCodes = () => {
    if (!global.serverRegistrationCodes) {
        global.serverRegistrationCodes = new Map();
    }
    return global.serverRegistrationCodes;
};

export const isAdminUser = (req) => req.session?.user?.role === 'admin';

export const getCurrentUser = async (req) => {
    if (!req.session?.userId) return null;
    return User.findById(req.session.userId);
};

export async function authorizeServerAccess({ server, req, hosted }) {
    if (isAdminUser(req)) return null;

    const regCodes = getRegistrationCodes();
    const currentUser = await getCurrentUser(req);
    const serverRegCode = regCodes.get(server.identifier);
    const userCode = currentUser?.registrationCode?.toUpperCase();

    if (hosted) {
        if (!userCode) {
            return 'You need a registration code to access servers';
        }
        if (serverRegCode !== userCode) {
            return 'You can only access your own servers';
        }
    } else if (serverRegCode && userCode && serverRegCode !== userCode) {
        return 'You can only access your own servers';
    }

    return null;
}

export const validateObjectIdOrSend = (res, id, field = 'server_id') => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: `Invalid ${field}` });
        return false;
    }
    return true;
};

export const toPlainObject = (maybeMap) => {
    if (maybeMap instanceof Map) {
        const plain = {};
        maybeMap.forEach((value, key) => {
            plain[key] = value;
        });
        return plain;
    }
    return { ...(maybeMap || {}) };
};

export const findOwnerByRegCode = (() => {
    const cache = new Map();
    return async (code) => {
        if (!code) return null;
        if (cache.has(code)) return cache.get(code);
        const owner = await User.findOne({ registrationCode: code });
        cache.set(code, owner);
        return owner;
    };
})();

export function isHostedEnvironment() {
    if (process.env.NODE_ENV !== 'production') {
        return false;
    }

    const hostname = os.hostname();
    return process.env.RENDER ||
           process.env.RAILWAY_ENVIRONMENT ||
           process.env.VERCEL ||
           hostname.includes('render') ||
           hostname.includes('railway') ||
           hostname.includes('vercel');
}
