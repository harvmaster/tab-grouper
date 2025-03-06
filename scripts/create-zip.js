/**
 * Create Zip script for Tab Groups Manager extension
 * 
 * This script creates a zip file for distributing the extension.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipFilename = 'tab-groups-manager.zip';
const zipPath = path.join(rootDir, zipFilename);

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory not found. Run npm run build first.');
  process.exit(1);
}

console.log('Creating extension package...');

try {
  // Remove existing zip file if it exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log(`Removed existing ${zipFilename}`);
  }
  
  // Create the zip file
  const command = process.platform === 'win32'
    ? `powershell Compress-Archive -Path "${distDir}/*" -DestinationPath "${zipPath}"`
    : `cd "${distDir}" && zip -r "${zipPath}" ./*`;
  
  execSync(command, { stdio: 'inherit' });
  
  console.log(`\nSuccessfully created: ${zipFilename}`);
  console.log(`Size: ${(fs.statSync(zipPath).size / 1024).toFixed(2)} KB`);
  console.log('\nThis zip file can be used for distribution or uploading to extension stores.');
} catch (error) {
  console.error(`\nError creating zip file: ${error.message}`);
  process.exit(1);
} 