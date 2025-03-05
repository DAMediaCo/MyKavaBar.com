#!/bin/bash

# Update second implementation (line 3583-3588)
sed -i '3583,3588c\
      // Ensure the bar photos directory exists\
      const barPhotosDir = path.join(process.cwd(), "public", "uploads", "bar-photos");\
      await mkdir(barPhotosDir, { recursive: true });\
\
      // Generate a unique filename\
      const filename = `${randomUUID()}.jpg`;\
      const filePath = path.join(barPhotosDir, filename);\
\
      console.log("Saving photo to:", filePath);\
      await fs.writeFile(filePath, processedImageBuffer);' server/routes.ts

# Update third implementation (line 4343-4348)
sed -i '4343,4348c\
      // Ensure the bar photos directory exists\
      const barPhotosDir = path.join(process.cwd(), "public", "uploads", "bar-photos");\
      await mkdir(barPhotosDir, { recursive: true });\
\
      // Generate a unique filename\
      const filename = `${randomUUID()}.jpg`;\
      const filePath = path.join(barPhotosDir, filename);\
\
      console.log("Saving photo to:", filePath);\
      await fs.writeFile(filePath, processedImageBuffer);' server/routes.ts
