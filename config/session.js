import session from 'express-session';
import MongoStore from 'connect-mongo';

/**
 * Create and configure Express session middleware
 * @returns {Function} Express session middleware
 */
export function createSessionMiddleware() {
    return session({
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            collectionName: 'sessions',
            ttl: 24 * 60 * 60 // 1 day in seconds
        }),
        cookie: {
            httpOnly: true, // Prevents client-side JS from accessing the cookie
            secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
            maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
            sameSite: 'lax' // CSRF protection
        },
        name: 'sessionId' // Custom cookie name (don't use default 'connect.sid')
    });
}

