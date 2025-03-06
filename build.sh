#!/bin/bash

# Build script for Tab Groups Manager extension

# Set up error handling
set -e

echo "Building Tab Groups Manager extension..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Clean up previous build artifacts
rm -f tab-groups-manager.zip
rm -rf dist

# Build the extension (this creates the dist directory with JavaScript files)
echo "Compiling TypeScript and bundling with webpack..."
npm run build

# Create icons directory in dist
echo "Creating extension package..."
mkdir -p dist/icons

# Copy the necessary files
cp popup.html dist/
cp manifest.json dist/
cp icons/*.png dist/icons/

echo "Build complete!"
echo "The extension is ready in the 'dist' directory."
echo ""
echo "To install the extension in Brave:"
echo "1. Go to brave://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'dist' directory" 