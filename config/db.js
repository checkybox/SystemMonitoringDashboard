import mongoose from 'mongoose';

export async function connectDB(mongoUrl) {
    if (!mongoUrl) {
        throw new Error('MONGO_URL is not defined');
    }

    await mongoose.connect(mongoUrl);
    console.log('MongoDB connected');
}
