import mongoose from 'mongoose';

const serverSchema = new mongoose.Schema({
    hostname: { type: String, required: true },
    username: { type: String, required: true },
    identifier: { type: String, required: true, unique: true }, // username@hostname
    arch: { type: String, required: true },
    os_type: { type: String, required: true },
    release: { type: String, required: true },
    cpuModel: { type: String },
    totalMemory: { type: Number },
    ownedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Which user owns this machine
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

const Server = mongoose.model('Server', serverSchema);

export default Server;

