#!/bin/bash

# Quick start script for the monitoring agent
# Usage: ./start-agent.sh [dashboard_url] [push_interval]

DASHBOARD_URL=${1:-"https://systemmonitoringdashboard-d1bh.onrender.com/"}
PUSH_INTERVAL=${2:-1}

echo "Starting System Monitoring Agent"
echo "================================"
echo "Dashboard URL: $DASHBOARD_URL"
echo "Push Interval: $PUSH_INTERVAL seconds"
echo ""

export DASHBOARD_URL
export PUSH_INTERVAL

node agent.js
