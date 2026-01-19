#!/bin/bash

# Start Firebase Emulators
# This script starts the Firebase emulators with proper configuration

echo "🚀 Starting Firebase Emulators..."
echo ""

# Set environment to avoid proxy issues
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""

cd "$(dirname "$0")"

# Start emulators
npx firebase emulators:start --project demo-vbs-tracker --import=./emulator-data --export-on-exit
