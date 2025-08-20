#!/bin/bash

APP_NAME="garbage_web_backend"
HOST="0.0.0.0"
PORT=5000

# Optionally set environment variables
export HOST=$HOST
export PORT=$PORT

# Start the Node.js server with PM2
pm2 start app.js --name $APP_NAME --env production