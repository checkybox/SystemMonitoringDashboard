import mongoose from 'mongoose';
const metricsSchema = new mongoose.Schema({
    server_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    cpuLoad: [Number],
    cpus: [{
        model: String,
        speed: Number,
        times: {
            user: Number,
            nice: Number,
            sys: Number,
            idle: Number,
            irq: Number
        }
    }],
    freeMem: Number,
    totalMem: Number,
    uptime: Number,
    networkInterfaces: {
        type: Map,
        of: [{
            address: String,
            netmask: String,
            family: String,
            mac: String,
            internal: Boolean,
            cidr: String
        }]
    },
    networkStats: {
        type: Map,
        of: {
            rxBytes: Number,
            rxPackets: Number,
            txBytes: Number,
            txPackets: Number
        }
    },
    diskUsage: {
        filesystem: String,
        size: String,
        used: String,
        available: String,
        usePercent: String,
        mountPoint: String
    },
    timestamp: { type: Date, default: Date.now }
});
const Metrics = mongoose.model('Metrics', metricsSchema);
export default Metrics;
