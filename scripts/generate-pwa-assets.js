import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const ICONS_DIR = './client/public/icons';
const SOURCE_IMAGE = './attached_assets/IMG_6371.jpg';

async function ensureDirectory(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function generatePWAAssets() {
  try {
    await ensureDirectory(ICONS_DIR);

    // Process source image first to ensure clean input
    const sourceBuffer = await sharp(SOURCE_IMAGE)
      .trim() // Remove any excess whitespace
      .toBuffer();

    // Generate basic icon set
    const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 192, 384, 512];

    for (const size of sizes) {
      await sharp(sourceBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 75, g: 0, b: 130, alpha: 1 }, // #4B0082
        })
        .png()
        .toFile(path.join(ICONS_DIR, `icon-${size}.png`));

      console.log(`Generated ${size}x${size} icon`);
    }

    // Create maskable icons with proper safe area
    const maskableSizes = [192, 512];
    for (const size of maskableSizes) {
      const safePadding = Math.floor(size * 0.1); // 10% padding for safe area
      const innerSize = size - (safePadding * 2);

      await sharp(sourceBuffer)
        .resize(innerSize, innerSize, {
          fit: 'contain',
          background: { r: 75, g: 0, b: 130, alpha: 1 }, // #4B0082
        })
        .extend({
          top: safePadding,
          bottom: safePadding,
          left: safePadding,
          right: safePadding,
          background: { r: 75, g: 0, b: 130, alpha: 1 }, // #4B0082
        })
        .png()
        .toFile(path.join(ICONS_DIR, `maskable-${size}.png`));

      console.log(`Generated ${size}x${size} maskable icon`);
    }

    // Generate iOS splash screens
    const splashSizes = [
      { width: 1290, height: 2796 }, // iPhone 14 Pro Max
      { width: 1179, height: 2556 }, // iPhone 14 Pro
      { width: 1284, height: 2778 }  // iPhone 14 Plus
    ];

    for (const { width, height } of splashSizes) {
      const logoSize = Math.min(width, height) * 0.4;

      await sharp(sourceBuffer)
        .resize(Math.floor(logoSize), Math.floor(logoSize), {
          fit: 'contain',
          background: { r: 75, g: 0, b: 130, alpha: 1 }, // #4B0082
        })
        .extend({
          top: Math.floor((height - logoSize) / 2),
          bottom: Math.floor((height - logoSize) / 2),
          left: Math.floor((width - logoSize) / 2),
          right: Math.floor((width - logoSize) / 2),
          background: { r: 75, g: 0, b: 130, alpha: 1 }, // #4B0082
        })
        .png()
        .toFile(path.join(ICONS_DIR, `splash-${width}x${height}.png`));

      console.log(`Generated ${width}x${height} splash screen`);
    }

    console.log('PWA assets generated successfully!');
  } catch (error) {
    console.error('Error generating PWA assets:', error);
    process.exit(1);
  }
}

generatePWAAssets().catch(console.error);