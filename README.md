# System Monitoring Dashboard

A real-time web-based dashboard for monitoring system metrics with drag-and-drop customizable widgets, dark mode support, and full CRUD API for server management.

## Team Members

- **Vitaliy Golubenko** (SE-2423)

## Features

- 📊 **Real-time System Monitoring** - CPU usage per core, memory stats, disk usage, network interfaces
- 🎨 **Customizable Layout** - Drag-and-drop grid system with resizable tiles
- 🌙 **Dark Mode** - Toggle between light and dark themes with localStorage persistence
- 🗄️ **MongoDB Integration** - Full CRUD API for server management

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose ODM
- **Frontend:** Vanilla JavaScript, Bootstrap 5, GridStack.js
- **Real-time Updates:** Fetch API with 1-second polling
- **Styling:** Custom CSS with CSS variables for theming

## How to Run the Project

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

### Installation Steps

1. **Clone the repository**

```bash
git clone https://github.com/checkybox/SystemMonitoringDashboard
cd SystemMonitoringDashboard
```

2. **Install dependencies**

```bash
npm install
```

3. **Create `.env` file** with your MongoDB connection string:

```env
PORT=3000
MONGO_URL="mongodb://localhost:27017/systemmonitoring"
```

For MongoDB Atlas, use:
```env
MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/systemmonitoring"
```

4. **Run the server**

```bash
node server.js
```

5. **Open your browser** and navigate to:
```
http://localhost:3000
```

## Database Schema

**Database Used:** MongoDB

### Collections

#### 1. Servers Collection

Stores information about monitored servers. Servers are automatically created when the dashboard runs on a new machine.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `_id` | ObjectId | MongoDB unique identifier | Auto-generated |
| `identifier` | String | Unique identifier (username@hostname) | Yes |
| `hostname` | String | Server hostname | Yes |
| `username` | String | System username | Yes |
| `arch` | String | System architecture (e.g., x64, arm64) | Yes |
| `osType` | String | Operating system type (e.g., Linux, Windows) | Yes |
| `release` | String | OS release/kernel version | Yes |
| `cpuModel` | String | CPU model name | No |
| `totalMemory` | Number | Total system memory in bytes | No |
| `lastSeen` | Date | Last time metrics were received | Auto-updated |
| `createdAt` | Date | Timestamp of record creation | Auto-generated |

**Example Document:**
```json
{
  "_id": "677f1234abcd5678efgh9012",
  "identifier": "checky@desktop",
  "hostname": "desktop",
  "username": "checky",
  "arch": "x64",
  "osType": "Linux",
  "release": "6.18.5-2-cachyos",
  "cpuModel": "AMD Ryzen 5 5600 6-Core Processor",
  "totalMemory": 33568346112,
  "lastSeen": "2026-01-18T10:30:00.000Z",
  "createdAt": "2026-01-17T08:15:00.000Z"
}
```

#### 2. Metrics Collection

Stores time-series metrics data for each server. New metrics are automatically saved every second when viewing the dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | MongoDB unique identifier |
| `server_id` | ObjectId | Reference to Servers collection |
| `cpuLoad` | Array[Number] | CPU load averages [1min, 5min, 15min] |
| `freeMem` | Number | Free memory in bytes |
| `totalMem` | Number | Total memory in bytes |
| `uptime` | Number | System uptime in seconds |
| `networkInterfaces` | Map | Network interface details (filtered: enp*, tailscale*, wlan*) |
| `timestamp` | Date | Time when metrics were collected |

**Example Document:**
```json
{
  "_id": "696be7d7b79e5d553c411d28",
  "server_id": "677f1234abcd5678efgh9012",
  "cpuLoad": [2.67, 2.6, 2.39],
  "freeMem": 21719748608,
  "totalMem": 33568346112,
  "uptime": 298696.74,
  "networkInterfaces": {
    "enp8s0": [
      {
        "address": "192.168.31.100",
        "family": "IPv4",
        "mac": "a8:a1:59:39:f5:46",
        "cidr": "192.168.31.100/24"
      }
    ]
  },
  "timestamp": "2026-01-18T10:30:15.000Z"
}
```

## API Documentation

### Home Page with Direct API Test Links

The home page (`/`) includes an interactive API Endpoints tile with clickable links to test all GET endpoints directly. POST/PUT/DELETE operations can be tested using Postman or curl.

### Global 404 Handler

- **HTML Routes:** Returns a styled 404 page with navigation
- **API Routes:** Returns JSON `{ "error": "API endpoint not found" }` with status 404

<details>
<summary><strong>📄 Page Routes</strong></summary>

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Home page with real-time system dashboard and API test links |
| GET | `/about` | About page with team information and planned features |
| GET | `/contact` | Contact form page |
| GET | `/machines` | Server management page showing all monitored servers |
| GET | `/settings` | Settings page with theme toggle |
| GET | `/search?q=QUERY` | Search page (requires query parameter `q`) |
| GET | `/item/:id` | Item detail page (route parameter example) |
| POST | `/contact` | Handle contact form submission (saves to JSON file) |

</details>

<details>
<summary><strong>🔧 System Monitoring API Endpoints</strong></summary>

### Static System Information
**GET** `/api/static-stats`

Returns static system information that doesn't change frequently.

**Response (200 OK):**
```json
{
  "arch": "x64",
  "release": "6.18.5-2-cachyos",
  "type": "Linux",
  "hostname": "desktop",
  "userInfo": {
    "username": "checky",
    "homedir": "/home/checky"
  },
  "cpus": [...]
}
```

### Dynamic System Metrics
**GET** `/api/stats`

Returns current system metrics and saves them to the database. Automatically creates server entry if it doesn't exist.

**Response (200 OK):**
```json
{
  "cpuLoad": [2.67, 2.6, 2.39],
  "freeMem": 21719748608,
  "totalMem": 33568346112,
  "uptime": 298696.74,
  "networkInterfaces": {...}
}
```

### Per-Core CPU Usage
**GET** `/api/cpu-per-core`

Returns CPU usage statistics for each core from `/proc/stat`.

### Network Statistics
**GET** `/api/network-stats`

Returns real-time network RX/TX bytes for each interface from `/proc/net/dev`.

### OS Release Information
**GET** `/api/os-release`

Returns OS release information from `/etc/os-release`.

### Disk Usage
**GET** `/api/disk-usage`

Returns disk usage information from `df -h` command.

</details>

<details>
<summary><strong>🗄️ CRUD API Endpoints for Servers</strong></summary>

All CRUD endpoints follow REST conventions with proper HTTP status codes and validation.

### Get All Servers
**GET** `/api/servers`

Returns all monitored servers with their metrics count.

**Query Parameters:**
- `sort` - Sort field (e.g., `?sort=hostname` or `?sort=-lastSeen`)
- `limit` - Limit number of results (e.g., `?limit=10`)
- `fields` - Select specific fields (e.g., `?fields=hostname,identifier`)

**Response (200 OK):**
```json
[
  {
    "_id": "677f1234abcd5678efgh9012",
    "identifier": "checky@desktop",
    "hostname": "desktop",
    "username": "checky",
    "arch": "x64",
    "osType": "Linux",
    "release": "6.18.5-2-cachyos",
    "metricsCount": 1234,
    "lastSeen": "2026-01-18T10:30:00.000Z",
    "createdAt": "2026-01-17T08:15:00.000Z"
  }
]
```

### Get Single Server
**GET** `/api/servers/:id`

Returns a single server by MongoDB `_id` or `identifier` (username@hostname).

**Examples:**
- `/api/servers/677f1234abcd5678efgh9012` (by MongoDB _id)
- `/api/servers/checky@desktop` (by identifier)

**Response:**
- **200 OK** - Server found
- **404 Not Found** - Server doesn't exist
- **500 Internal Server Error** - Database error

### Create New Server
**POST** `/api/servers`

Create a new server entry manually.

**Required Fields:**
```json
{
  "hostname": "server01",
  "username": "admin",
  "arch": "x64",
  "os_type": "Linux",
  "release": "6.18.2"
}
```

**Optional Fields:** `cpuModel`, `totalMemory`

**Response:**
- **201 Created** - Server created successfully
- **400 Bad Request** - Missing required fields or duplicate identifier
- **500 Internal Server Error** - Database error

### Update Server
**PUT** `/api/servers/:id`

Update an existing server by MongoDB `_id`. Supports partial updates.

**Request Body (at least one field required):**
```json
{
  "hostname": "server01-updated",
  "release": "6.18.6"
}
```

**Response:**
- **200 OK** - Server updated successfully
- **400 Bad Request** - Invalid ID or no fields provided
- **404 Not Found** - Server doesn't exist
- **500 Internal Server Error** - Database error

### Delete Server
**DELETE** `/api/servers/:id`

Delete a server and all its associated metrics by MongoDB `_id`.

**Query Parameters:**
- `dryRun=true` - Preview what would be deleted without actually deleting

**Examples:**
- `/api/servers/677f1234abcd5678efgh9012` (actual delete)
- `/api/servers/677f1234abcd5678efgh9012?dryRun=true` (preview only)

**Response (Dry-Run):**
```json
{
  "message": "Dry-run mode: No data was deleted",
  "dryRun": true,
  "wouldDelete": {
    "server": {...},
    "metricsCount": 1234
  }
}
```

**Response (Actual Delete):**
```json
{
  "message": "Server deleted successfully",
  "server": {...},
  "metricsDeleted": 1234
}
```

**Status Codes:**
- **200 OK** - Server deleted or dry-run preview
- **400 Bad Request** - Invalid server ID
- **404 Not Found** - Server doesn't exist
- **500 Internal Server Error** - Database error

### Get Server Metrics
**GET** `/api/servers/:id/metrics`

Get time-series metrics for a specific server.

**Query Parameters:**
- `limit` - Number of records to return (default: 100, e.g., `?limit=50`)
- `since` - Minutes ago (e.g., `?since=60` for last hour)

**Examples:**
- `/api/servers/checky@desktop/metrics?limit=5`
- `/api/servers/677f1234abcd5678efgh9012/metrics?since=60&limit=100`

**Response (200 OK):**
```json
{
  "server": {
    "_id": "677f1234abcd5678efgh9012",
    "identifier": "checky@desktop",
    "hostname": "desktop",
    "username": "checky"
  },
  "count": 5,
  "metrics": [...]
}
```

</details>

### HTTP Status Codes

All API endpoints use proper HTTP status codes:

| Code | Usage |
|------|-------|
| **200 OK** | Successful GET, PUT, DELETE operations |
| **201 Created** | Successful POST (resource created) |
| **400 Bad Request** | Invalid ID format, missing required fields, or invalid parameters |
| **404 Not Found** | Resource doesn't exist |
| **500 Internal Server Error** | Database or server error |

## Middleware

The application uses the following middleware stack:

1. **Custom Logger Middleware** - Logs all requests with timestamp, method, and URL
2. **express.urlencoded({ extended: true })** - Parses URL-encoded form data
3. **express.json()** - Parses JSON request bodies
4. **express.static('public')** - Serves static files (CSS, JS) with 1-day cache
5. **express.static('assets')** - Serves image assets with 7-day cache
