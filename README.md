# System Monitoring Dashboard

A minimal web-based dashboard for viewing system metrics such as CPU load, memory usage, uptime, and more. Now includes database integration with full CRUD API for server management.

## Team members

- Vitaliy Golubenko (SE-2423)

## Database

**Database Used:** MongoDB

### Server Collection Structure

The `servers` collection stores information about monitored servers with the following fields:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | Number | Unique identifier (Primary Key) | Yes |
| `hostname` | String | Server hostname | Yes |
| `arch` | String | System architecture (e.g., x86_64, arm64) | Yes |
| `os_type` | String | Operating system type (e.g., Linux, Windows) | Yes |
| `release` | String | OS release/kernel version | Yes |
| `createdAt` | Date | Timestamp of record creation | Auto-generated |

### Example Server Document

```json
{
  "id": 1,
  "hostname": "server01",
  "arch": "x86_64",
  "os_type": "Linux",
  "release": "6.18.2",
  "createdAt": "2026-01-11T10:30:00.000Z"
}
```

## Team member contributions

### Vitaliy Golubenko
- Implemented Express.js server with routing and middleware
- Created all HTML pages (home, about, contact, 404)
- Developed API endpoints for system monitoring
- Implemented contact form with server-side validation and JSON file storage
- Added search and item detail routes with parameter handling
- Integrated Bootstrap for responsive UI design
- Set up custom logger middleware
- Integrated MongoDB database with Mongoose
- Implemented complete CRUD API for server management
- Added proper validation and HTTP status codes (200, 201, 400, 404, 500)

## Project roadmap

- Week 1
    - Basic Express.js server
    - Project's landing page
- Week 2
    - API endpoints for system metrics
    - Frontend for basic statistics display
    - Contact form and about page
- Week 3-4
    - Custom logger middleware
    - Query parameter handling (/search)
    - Route parameter handling (/item/:id)
    - Server-side validation with proper HTTP status codes
    - Contact form data saving to JSON file
    - JSON API endpoint for project information

## Routes

### Page Routes

- **GET /** — Home page with system overview and navigation
  - Displays real-time system metrics
  - Shows CPU, memory, uptime, and disk usage
  
- **GET /about** — About page with team information and planned features
  - Team member details
  - Future feature roadmap displayed as Bootstrap cards
  
- **GET /contact** — Contact form page
  - HTML form with name, email, and message fields
  - Client-side and server-side validation
  
- **GET /search?q=QUERY** — Search results page (uses query parameter)
  - Requires query parameter `q`
  - Returns 400 error if `q` is missing
  - Placeholder for future search functionality
  
- **GET /item/:id** — Item detail page (uses route parameter)
  - Displays details for a specific item ID
  - Captures route parameter from URL
  - Placeholder for future machine/process details

### Form Handling

- **POST /contact** — Contact form submission handler
  - Validates required fields (name, email, message)
  - Returns 400 error if any field is missing
  - Saves submission to `contact-submissions.json` using `fs.writeFile()`
  - Returns thank-you message on success

### API Endpoints (JSON)

#### System Information Endpoints

- **GET /api/info** — Returns project information in JSON format
  - Project name, version, description
  - Complete list of available routes
  - Author information
  
- **GET /api/static-stats** — Static system information as JSON
  - Architecture, hostname, OS type
  - CPU information
  - User information
  
- **GET /api/stats** — Dynamic system statistics as JSON
  - Free/total memory
  - CPU load averages
  - System uptime
  - Network interfaces

#### CRUD API Endpoints for Servers

All CRUD endpoints follow REST conventions and return JSON responses with appropriate HTTP status codes.

- **GET /api/servers** — Get all servers
  - Returns: Array of all server records sorted by `id` (ascending)
  - Status: `200 OK`
  - Response example:
    ```json
    [
      {
        "id": 1,
        "hostname": "server01",
        "arch": "x86_64",
        "os_type": "Linux",
        "release": "6.18.2",
        "createdAt": "2026-01-11T10:30:00.000Z"
      }
    ]
    ```

- **GET /api/servers/:id** — Get a single server by id
  - Returns: Single server record matching the provided `id`
  - Status: `200 OK` (success), `400 Bad Request` (invalid id), `404 Not Found` (server not found)
  - Response example:
    ```json
    {
      "id": 1,
      "hostname": "server01",
      "arch": "x86_64",
      "os_type": "Linux",
      "release": "6.18.2",
      "createdAt": "2026-01-11T10:30:00.000Z"
    }
    ```

- **POST /api/servers** — Create a new server
  - Required fields: `id`, `hostname`, `arch`, `os_type`, `release`
  - Status: `201 Created` (success), `400 Bad Request` (missing/invalid fields)
  - Request body example:
    ```json
    {
      "id": 2,
      "hostname": "server02",
      "arch": "arm64",
      "os_type": "Linux",
      "release": "6.20.1"
    }
    ```

- **PUT /api/servers/:id** — Update an existing server
  - Optional fields: `hostname`, `arch`, `os_type`, `release` (at least one required)
  - Status: `200 OK` (success), `400 Bad Request` (invalid id or no fields), `404 Not Found` (server not found)
  - Request body example:
    ```json
    {
      "hostname": "server02-updated",
      "release": "6.21.0"
    }
    ```

- **DELETE /api/servers/:id** — Delete a server by id
  - Status: `200 OK` (success), `400 Bad Request` (invalid id), `404 Not Found` (server not found)
  - Response example:
    ```json
    {
      "message": "Server deleted successfully",
      "server": { ... }
    }
    ```

#### Validation and Error Handling

All CRUD endpoints implement proper validation:
- Invalid `id` (non-integer) → `400 Bad Request` with `{ "error": "Invalid id" }`
- Missing required fields → `400 Bad Request` with descriptive error message
- Record not found → `404 Not Found` with `{ "error": "Server not found" }`
- Server errors → `500 Internal Server Error` with `{ "error": "Internal server error" }`
  
- **GET /api/os-release** — OS release information as plain text
  - Contents of `/etc/os-release` file
  
- **GET /api/disk-usage** — Disk usage statistics as plain text
  - Output of `df -h` command
  
- **GET /api/free** — Memory usage information as plain text
  - Output of `free -h` command

### Error Handling

- **404** — Not Found
  - HTML page for regular routes (e.g., `/unknown-page`)
  - JSON response for API routes (e.g., `/api/unknown-endpoint`)
    ```json
    { "error": "API endpoint not found" }
    ```
  - Consistent navigation and branding on HTML pages

## Middleware

The application uses the following middleware:

1. **Custom Logger Middleware** — Logs all incoming requests
   - Format: `[timestamp] METHOD URL`
   - Runs before all routes
   
2. **express.static('public')** — Serves static files (CSS, JS)
   
3. **express.static('assets')** — Serves assets like images at `/assets` path
   
4. **express.urlencoded({ extended: true })** — Parses URL-encoded form data
   
5. **express.json()** — Parses JSON request bodies

## Contact form details

The contact form (served at `/contact`) includes the following fields and submits to `POST /contact`:

- **name** (text input) — Required
- **email** (email input) — Required
- **message** (textarea) — Required

### Server-side validation:
- All fields are validated on the server
- Missing fields return HTTP 400 status with error message
- Valid submissions are saved to `contact-submissions.json` with timestamp

### Data storage:
- Contact submissions are saved to `contact-submissions.json` in the project root
- Each submission includes: name, email, message, and ISO timestamp
- Uses `fs.writeFile()` to persist data
- File is created automatically if it doesn't exist

## How to Run the Project

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

### Installation Steps

1. Clone the repository

```bash
git clone https://github.com/checkybox/SystemMonitoringDashboard
```

2. Navigate into the project

```bash
cd SystemMonitoringDashboard
```

3. Install dependencies

```bash
npm install
```

4. Create and populate `.env` file with your MongoDB connection string:

```env
PORT=3000
MONGO_URL="mongodb://localhost:27017/systemmonitoring"
```

For MongoDB Atlas, use:
```env
MONGO_URL="mongodb+srv://username:password@cluster.mongodb.net/systemmonitoring"
```

5. Run the server

```bash
node server.js
```

The application will be available at `http://localhost:3000`

### Optional: Seed Database with Sample Data

To populate the database with sample server records for testing:

```bash
npm run seed
```

This will create 3 sample servers with IDs 1, 2, and 3.