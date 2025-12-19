const express = require('express')
const os = require('os')
const { exec } = require('child_process')

const PORT = 3000
const app = express()

app.use(express.static('public'))
app.use('/assets', express.static('assets'))
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/views/about.html')
})

app.get('/contact', (req, res) => {
    res.sendFile(__dirname + '/views/contact.html')
})

app.post('/contact', (req, res) => {
    console.log(req.body);
    res.send(`<h2>Thanks, ${req.body.name}! Your message has been received.</h2>`);
});

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
        freeMem: os.freemem(),
        homedir: os.homedir(),
        cpuLoad: os.loadavg(),
        machine: os.machine(),
        networkInterfaces: os.networkInterfaces(),
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

app.use((req, res) => {
    res.status(404).sendFile(__dirname + '/views/404.html')
})

app.listen(PORT, () => {
    console.log('Server running on http://localhost:3000')
})