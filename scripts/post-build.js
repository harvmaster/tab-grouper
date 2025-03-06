/**
 * Post-build script for Tab Groups Manager extension
 * 
 * This script copies necessary files to the dist directory and
 * logs installation instructions to the console.
 */

const fs = require('fs');
const path = require('path');

// Paths
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const iconsDir = path.join(distDir, 'icons');

// Ensure dist and icons directories exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Files to copy
const filesToCopy = [
  { src: 'popup.html', dest: 'popup.html' },
  { src: 'manifest.json', dest: 'manifest.json' },
  { src: 'icons/icon16.png', dest: 'icons/icon16.png' },
  { src: 'icons/icon32.png', dest: 'icons/icon32.png' },
  { src: 'icons/icon48.png', dest: 'icons/icon48.png' },
  { src: 'icons/icon128.png', dest: 'icons/icon128.png' }
];

// Copy each file
filesToCopy.forEach(file => {
  const srcPath = path.join(rootDir, file.src);
  const destPath = path.join(distDir, file.dest);
  
  try {
    // Check if source file exists
    if (!fs.existsSync(srcPath)) {
      console.error(`Source file not found: ${srcPath}`);
      return;
    }
    
    // Ensure the destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Copy the file
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied: ${file.src} -> ${file.dest}`);
  } catch (error) {
    console.error(`Error copying ${file.src}: ${error.message}`);
  }
});

// Print completion message and installation instructions
console.log('\n' + '='.repeat(80));
console.log('\nTab Groups Manager extension build complete!');
console.log('\nThe extension is ready in the "dist" directory.');
console.log('\nTo install the extension in Brave or Chrome:');
console.log('1. Go to brave://extensions/ or chrome://extensions/');
console.log('2. Enable "Developer mode" in the top right corner');
console.log('3. Click "Load unpacked" button');
console.log('4. Select the "dist" directory from this project');
console.log('\n' + '='.repeat(80) + '\n'); 