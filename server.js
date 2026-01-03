const express = require('express')
const os = require('os')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const PORT = 3000
const app = express()

// logger middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
})

app.use(express.static('public')) // expose public directory
app.use('/assets', express.static('assets')) // expose assets directory on mount point /assets
app.use(express.urlencoded({ extended: true })) // middleware to handle form submissions
app.use(express.json()) // middleware to parse JSON bodies

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
    const { name, email, message } = req.body

    if (!name || !email || !message) {
        return res.status(400).send('<h2>Error: All fields (name, email, message) are required.</h2>')
    }

    const contactData = {
        name,
        email,
        message,
        timestamp: new Date().toISOString()
    }

    const filePath = path.join(__dirname, 'contact-submissions.json')

    let submissions = []
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8')
            submissions = JSON.parse(fileContent)
        } catch (err) {
            console.error('Error reading existing submissions:', err)
        }
    }

    submissions.push(contactData)

    fs.writeFile(filePath, JSON.stringify(submissions, null, 2), (err) => {
        if (err) {
            console.error('Error saving contact form:', err)
            return res.status(500).send('<h2>Error saving your message. Please try again.</h2>')
        }

        console.log('Contact form saved:', contactData)
        res.send(`<h2>Thanks, ${name}! Your message has been received and saved.</h2>`)
    })
});

app.get('/search', (req, res) => {
    const query = req.query.q

    if (!query) {
        return res.status(400).send('<h2>Error: Search query parameter "q" is required.</h2><p>Example: /search?q=cpu</p>')
    }

    res.sendFile(__dirname + '/views/search.html')
})

app.get('/item/:id', (req, res) => {
    const itemId = req.params.id

    if (!itemId) {
        return res.status(400).send('<h2>Error: Item ID is required.</h2>')
    }

    res.sendFile(__dirname + '/views/item.html')
})

app.get('/api/info', (req, res) => {
    const projectInfo = {
        projectName: 'System Monitoring Dashboard',
        version: '1.0.0',
        description: 'A minimal web-based dashboard for viewing system metrics such as CPU load, memory usage, uptime, and more.',
        author: 'Vitaliy Golubenko (SE-2423)',
        routes: {
            pages: [
                { path: '/', method: 'GET', description: 'Home page with system overview' },
                { path: '/about', method: 'GET', description: 'About page with team info and planned features' },
                { path: '/contact', method: 'GET', description: 'Contact form page' },
                { path: '/search', method: 'GET', description: 'Search page (query parameter: q)' },
                { path: '/item/:id', method: 'GET', description: 'Item detail page (route parameter: id)' }
            ],
            api: [
                { path: '/api/info', method: 'GET', description: 'Returns project information in JSON format' },
                { path: '/api/static-stats', method: 'GET', description: 'Returns static system information' },
                { path: '/api/stats', method: 'GET', description: 'Returns dynamic system statistics' },
                { path: '/api/os-release', method: 'GET', description: 'Returns OS release information' },
                { path: '/api/disk-usage', method: 'GET', description: 'Returns disk usage statistics' },
                { path: '/api/free', method: 'GET', description: 'Returns memory usage information' }
            ],
            forms: [
                { path: '/contact', method: 'POST', description: 'Handles contact form submission' }
            ]
        },
        timestamp: new Date().toISOString()
    }

    res.json(projectInfo)
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