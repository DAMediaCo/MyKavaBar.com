import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanupPhotos() {
  const files = [
    'e0af3e02-7f03-4c60-9a46-5e8a2d268b1c.jpg',
    'e16e2e45-a6a5-4577-9a5c-456c6f30bb41.jpg',
    '3c7c0644-4c11-4ccf-832c-fb2b96bc1bc7.jpg',
    '08e04f8d-c3f3-4b8c-a8f6-9edc5d74fe6f.jpg'
  ];

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

  for (const file of files) {
    try {
      await fs.unlink(path.join(uploadsDir, file));
      console.log(`Deleted ${file}`);
    } catch (error) {
      console.error(`Error deleting ${file}:`, error.message);
    }
  }
}

cleanupPhotos();