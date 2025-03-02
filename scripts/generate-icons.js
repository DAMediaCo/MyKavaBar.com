import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

async function generateIcons() {
  const sizes = [192, 512];
  const inputImage = 'attached_assets/IMG_6371.jpg';
  
  // Ensure public/icons directory exists
  await fs.mkdir('client/public/icons', { recursive: true });
  
  for (const size of sizes) {
    await sharp(inputImage)
      .resize(size, size)
      .toFile(`client/public/icons/icon-${size}.png`);
    
    console.log(`Generated ${size}x${size} icon`);
  }
}

generateIcons().catch(console.error);
