#!/usr/bin/env node

/**
 * This script ensures that the necessary directories for photo uploads exist.
 * It should be run when the server starts or as part of a deployment process.
 */

const fs = require('fs/promises');
const path = require('path');

const directories = [
  path.join(process.cwd(), 'public', 'uploads'),
  path.join(process.cwd(), 'public', 'uploads', 'bar-photos'),
  path.join(process.cwd(), 'public', 'uploads', 'profiles')
];

async function ensureDirectories() {
  try {
    console.log('Ensuring photo upload directories exist...');
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`✓ Directory exists: ${dir}`);
      } catch (err) {
        console.error(`Error creating directory ${dir}:`, err);
      }
    }
    
    console.log('Photo upload directories ready.');
  } catch (error) {
    console.error('Error ensuring directories:', error);
    process.exit(1);
  }
}

// If this script is run directly
if (require.main === module) {
  ensureDirectories();
}

module.exports = { ensureDirectories };