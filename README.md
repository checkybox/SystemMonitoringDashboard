# System Monitoring Dashboard

A minimal web-based dashboard for viewing system metrics such as CPU load, memory usage, uptime, and more.

## Team members

- Vitaliy Golubenko (SE-2423)

## Team member contributions

### Vitaliy Golubenko
- Implemented Express.js server with routing and middleware
- Created all HTML pages (home, about, contact, 404)
- Developed API endpoints for system monitoring
- Implemented contact form with server-side validation and JSON file storage
- Added search and item detail routes with parameter handling
- Integrated Bootstrap for responsive UI design
- Set up custom logger middleware

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
  
- **GET /api/os-release** — OS release information as plain text
  - Contents of `/etc/os-release` file
  
- **GET /api/disk-usage** — Disk usage statistics as plain text
  - Output of `df -h` command
  
- **GET /api/free** — Memory usage information as plain text
  - Output of `free -h` command

### Error Handling

- **404** — Not Found
  - Custom 404 page for undefined routes
  - Consistent navigation and branding

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

## Installation

1. Clone the repository

```
git clone https://github.com/checkybox/SystemMonitoringDashboard
```

2. Navigate into the project

```
cd SystemMonitoringDashboard
```

3. Install dependencies

```
npm install
```

4. Create and populate `.env` file, for example:

```
PORT=3000
MONGO_URL="mongodb://localhost:27017/yourdbname"
```

5. Run the server

```
node server.js
```

The application will be available at `http://localhost:3000`
