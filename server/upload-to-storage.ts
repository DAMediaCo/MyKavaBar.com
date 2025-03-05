import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,

    region: "auto",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

const generatePublicUrl = (fileName: string) => {
    return `${process.env.R2_PUBLIC_URL}/${fileName}`;
};

export const uploadImageToStorage = async (
    buffer: Buffer,
    fileName: string,
) => {
    try {
        // Check if environment variables are properly set
        if (!process.env.R2_BUCKET) {
            console.error("R2_BUCKET environment variable is not set");
            throw new Error("Storage configuration missing");
        }
        
        console.log(`Uploading file: ${fileName} (${buffer.length} bytes) to bucket: ${process.env.R2_BUCKET}`);
        
        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: fileName,
            Body: buffer,
            ContentType: "image/jpeg",
            ACL: "public-read",
        });

        await s3Client.send(uploadCommand);
        const publicUrl = generatePublicUrl(fileName);
        console.log("Successfully uploaded image to storage:", publicUrl);
        return { publicUrl };
    } catch (error: any) {
        console.error("[UPLOAD TO STORAGE ERROR]", error.message, error.stack);
        throw new Error(`Failed to upload file to storage: ${error.message}`);
    }
};
