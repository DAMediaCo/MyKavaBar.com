import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: fileName,
            Body: buffer,
        });

        await s3Client.send(uploadCommand);
        const publicUrl = generatePublicUrl(fileName);
        console.log("Uploaded image to R2:", publicUrl);
        return { publicUrl };
    } catch (error: any) {
        console.error("[UPLOAD TO STORAGE ERROR]", error.message);
        throw new Error(error || "Failed to upload file to storage");
    }
};
