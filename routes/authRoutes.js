import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Helper function to generate unique 8-character registration code (uppercase letters and digits)
function generateRegistrationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// POST /auth/register - Register a new user (PUBLIC - anyone can register)
router.post('/register', async (req, res) => {
    const { username, email, password, fullName } = req.body;

    // Validate required fields
    if (!username || !email || !password || !fullName) {
        return res.status(400).json({
            error: 'All fields are required',
            fields: ['username', 'email', 'password', 'fullName']
        });
    }

    // Validate username length
    if (username.length < 3) {
        return res.status(400).json({
            error: 'Username must be at least 3 characters long'
        });
    }

    // Validate password length
    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters long'
        });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: 'Invalid email format'
        });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Username or email already exists'
            });
        }

        // Everyone becomes regular user by default
        // Admin role must be set manually via MongoDB Compass
        const userRole = 'user';

        // Generate unique registration code (8 characters, uppercase)
        let registrationCode;
        let isUnique = false;

        while (!isUnique) {
            registrationCode = generateRegistrationCode();
            const existing = await User.findOne({ registrationCode });
            if (!existing) isUnique = true;
        }

        // Create new user (password will be hashed automatically by pre-save hook)
        const newUser = new User({
            username,
            email,
            password,
            fullName,
            role: userRole,
            registrationCode
        });

        await newUser.save();

        // Create session
        req.session.userId = newUser._id;
        req.session.user = {
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName,
            role: newUser.role
        };

        // IMPORTANT: Save session before responding (critical for hosted environments)
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    error: 'Registration successful but session creation failed. Please login manually.'
                });
            }

            res.status(201).json({
                message: 'Registration successful',
                user: {
                    username: newUser.username,
                    email: newUser.email,
                    fullName: newUser.fullName,
                    role: newUser.role,
                    registrationCode: newUser.registrationCode
                }
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed. Please try again.'
        });
    }
});

// POST /auth/login - Login user (PUBLIC)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password are required'
        });
    }

    try {
        // Find user by username or email
        const user = await User.findOne({
            $or: [{ username }, { email: username }]
        });

        // Generic error message for security (don't reveal if user exists)
        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Create session
        req.session.userId = user._id;
        req.session.user = {
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role
        };

        // IMPORTANT: Save session before responding (critical for hosted environments)
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    error: 'Login successful but session creation failed. Please try again.'
                });
            }

            res.status(200).json({
                message: 'Login successful',
                user: {
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed. Please try again.'
        });
    }
});

// POST /auth/logout - Logout user
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({
                    error: 'Logout failed'
                });
            }
            res.clearCookie('sessionId'); // Clear session cookie (matches name in server.js)
            res.status(200).json({
                message: 'Logout successful'
            });
        });
    } else {
        res.status(200).json({
            message: 'No active session'
        });
    }
});

// GET /auth/check - Check if user is logged in
router.get('/check', (req, res) => {
    if (req.session && req.session.userId) {
        res.status(200).json({
            isAuthenticated: true,
            user: req.session.user
        });
    } else {
        res.status(200).json({
            isAuthenticated: false,
            user: null
        });
    }
});

// GET /api/user/me - Get current user's full information (PROTECTED)
router.get('/api/user/me', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
