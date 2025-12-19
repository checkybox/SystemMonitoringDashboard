async function loadStaticStats() {
    const res = await fetch('/api/static-stats')
    const data = await res.json()

    document.getElementById('username+hostname').textContent = data.userInfo.username + "@" + data.hostname
    document.getElementById('os+arch').textContent = data.type + " " + "(" + data.arch + ")"
    document.getElementById('kernel-version').textContent = data.release
    document.getElementById('cpu-info').textContent = data.cpus[0].model
}

async function loadStats() {
    const res = await fetch('/api/stats')
    const data = await res.json()

    const uptime_hours = Math.floor(data.uptime / 3600)
    const uptime_minutes = Math.floor((data.uptime % 3600) / 60)
    const uptime_seconds = Math.floor(data.uptime % 60)
    const formattedUptime = `${uptime_hours}h ${uptime_minutes}m ${uptime_seconds}s`

    // document.getElementById('username+hostname').textContent = data.userInfo.username + "@" + data.hostname
    // document.getElementById('os+arch').textContent = data.type + " " + "(" + data.arch + ")"
    // document.getElementById('kernel-version').textContent = data.release
    // document.getElementById('cpu-info').textContent = data.cpus[0].model
    document.getElementById('total-memory').textContent = (data.totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    document.getElementById('free-memory').textContent = (data.freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    document.getElementById('cpu-load').textContent = data.cpuLoad.join(', ')
    document.getElementById('uptime').textContent = formattedUptime
}

async function getOsRelease() {
    const res = await fetch('/api/os-release')
    const data = await res.text()
    console.log(data)
}

async function getDiskUsage() {
    const res = await fetch('/api/disk-usage')
    const data = await res.text()

    // split on newlines, trim each line, remove empty lines
    const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)

    // store for later use and return
    window.diskUsageLines = lines
    console.log(data)
    return lines
}

loadStaticStats()
loadStats()
getOsRelease()
getDiskUsage()
setInterval(loadStats, 1000) // auto-refresh every 1 second

