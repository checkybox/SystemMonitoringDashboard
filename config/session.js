import session from 'express-session';
import MongoStore from 'connect-mongo';

export function createSessionMiddleware() {
    return session({
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            collectionName: 'sessions',
            ttl: 24 * 60 * 60
        }),
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        },
        name: 'sessionId'
    });
}
