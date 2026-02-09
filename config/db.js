import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 * @param {string} mongoUrl - MongoDB connection URL
 */
export async function connectDB(mongoUrl) {
    try {
        await mongoose.connect(mongoUrl);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

