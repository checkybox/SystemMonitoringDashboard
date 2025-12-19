# System Monitoring Dashboard

A minimal web-based dashboard for viewing system metrics such as CPU load, memory usage, uptime, and more.

## Team members

- Vitaliy Golubenko (SE-2423)

## Project roadmap

- Week 1
    - Basic Express.js server
    - Project's landing page
- Week 2
    - API endpoints for system metrics
    - Frontend for basic statistics display
    - Contact form and about page

## Routes

- GET / — Home (main page with intro and navigation)
- GET /about — Short info about the team/project
- GET /contact — Contact page (contains an HTML form)
- POST /contact — Form submission handler (server logs the form data and responds with a thank-you message)

API endpoints (examples used by the UI):

- GET /api/free — Runs `free -h` on the server and returns the output (used to display memory stats)
- GET /api/disk-usage — Runs `df -h` on the server and returns disk usage statistics as text
- GET /api/os-release — Returns the contents of `/etc/os-release`
- GET /api/static-stats — JSON with static system info (hostname, platform, architecture, etc.)
- GET /api/stats — JSON with various OS stats (cpus, memory, uptime, etc.)

## Contact form details

The contact form (served at `/contact`) includes the following fields and submits to `POST /contact`:

- name (text input)
- email (email input)
- message (textarea)

On submit the server receives URL-encoded form data and (in the current implementation) prints it to the server console and returns a small thank-you HTML response.

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

4. Run the server

```
node server.js
```

The application will be available at `http://localhost:3000`
