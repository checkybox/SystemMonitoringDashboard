const express = require('express')
const os = require('os')
const { exec } = require('child_process')

const app = express()
app.use(express.static('public'))
app.use('/assets', express.static('assets'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})

app.get('/api/stats', (req, res) => {
    const data = {
        cpuLoad: os.loadavg(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        uptime: os.uptime(),
    }
    res.json(data)
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

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000')
})