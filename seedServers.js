// Script to populate the database with sample server data
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Define Server schema
const serverSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    hostname: { type: String, required: true },
    arch: { type: String, required: true },
    os_type: { type: String, required: true },
    release: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Server = mongoose.model('Server', serverSchema);

// Connect to MongoDB and seed data
async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing servers
        await Server.deleteMany({});
        console.log('Cleared existing servers');

        // Insert sample servers
        await Server.insertMany([
            { id: 1, hostname: 'server01', arch: 'x86_64', os_type: 'Linux', release: '6.18.2' },
            { id: 2, hostname: 'server02', arch: 'arm64', os_type: 'Linux', release: '6.20.1' },
            { id: 3, hostname: 'win-server', arch: 'x86_64', os_type: 'Windows', release: '10.0.19045' }
        ]);

        console.log('Sample servers created successfully');
        console.log('Total servers in database:', await Server.countDocuments());

        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();

