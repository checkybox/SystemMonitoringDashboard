import mongoose from 'mongoose';

export async function connectDB(mongoUrl) {
    try {
        await mongoose.connect(mongoUrl);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

