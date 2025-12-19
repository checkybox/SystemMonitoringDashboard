const express = require('express')
const os = require('os')
const { exec } = require('child_process')

const PORT = 3000
const app = express()
app.use(express.static('public'))
app.use('/assets', express.static('assets'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/views/about.html')
})

app.get('/api/static-stats', (req, res) => {
    const data = {
        arch: os.arch(),
        release: os.release(),
        type: os.type(),
        hostname: os.hostname(),
        userInfo: os.userInfo(),
        cpus: os.cpus(),
    }
    res.json(data)
})

app.get('/api/stats', (req, res) => {
    const data = {
        arch: os.arch(),
        cpus: os.cpus(),
        freeMem: os.freemem(),
        homedir: os.homedir(),
        hostname: os.hostname(),
        cpuLoad: os.loadavg(),
        machine: os.machine(),
        networkInterfaces: os.networkInterfaces(),
        release: os.release(),
        version: os.version(), // trash
        type: os.type(),
        userInfo: os.userInfo(),
        totalMem: os.totalmem(),
        uptime: os.uptime(),
    }
    res.json(data)
})

app.get('/api/os-release', (req, res) => {
    exec('cat /etc/os-release', (err, stdout) => {
        if (err) {
            console.error(err)
            res.status(500).send('Error executing command')
            return;
        }
        res.send(stdout)
    })
})

app.get('/api/disk-usage', (req, res) => {
    exec('df -h', (err, stdout) => {
        if (err) {
            console.error(err)
            res.status(500).send('Error executing command')
            return;
        }
        res.send(stdout)
    })
})

app.get('/api/free', (req, res) => {
    exec('free -h', (err, stdout) => {
        if (err) {
            console.error(err)
            res.status(500).send('Error executing command')
            return;
        }
        res.send(stdout)
    })
})

app.get('/api/ls', (req, res) => {
    exec('ls -l', (err, stdout) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`stdout: ${stdout}`)
        console.error(`stderr: ${err}`)
    })
    res.send('Executed ls -l command. Check server console for output.')
})

app.listen(PORT, () => {
    console.log('Server running on http://localhost:3000')
})