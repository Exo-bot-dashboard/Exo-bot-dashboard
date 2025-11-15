#!/bin/bash
set -e  # Exit immediately if any command fails
echo "Building frontend..."
npm run build
echo "Frontend build successful!"
echo "Starting server..."
tsx server/index.ts
