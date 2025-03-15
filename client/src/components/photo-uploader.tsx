import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, RotateCcw } from "lucide-react";

interface Props {
  barId: number;
  onSuccess?: () => void;
}

export function PhotoUploader({ barId, onSuccess }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 25MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRotation(0); // Reset rotation on new selection
  };

  const rotateImage = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const rotatedBlob = await applyRotation(selectedFile, rotation);
      const formData = new FormData();
      formData.append("photo", rotatedBlob, selectedFile.name);

      const response = await fetch(`/api/bars/${barId}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({ title: "Success", description: "Photo uploaded successfully" });
      setImagePreview(null);
      setSelectedFile(null);
      setRotation(0);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const applyRotation = (file: File, rotation: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));

        // Adjust canvas size based on rotation
        if (rotation % 180 === 0) {
          canvas.width = img.width;
          canvas.height = img.height;
        } else {
          canvas.width = img.height;
          canvas.height = img.width;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to process image"));
        }, file.type);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="photo-upload"
        disabled={isUploading}
        onClick={(e) => (e.currentTarget.value = "")} // Fix: Reset input on click
      />

      <label htmlFor="photo-upload">
        <Button disabled={isUploading} asChild>
          <span>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" /> Upload Photo
              </>
            )}
          </span>
        </Button>
      </label>

      {imagePreview && (
        <div className="relative flex flex-col items-center">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-xs max-h-64 object-contain"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
          <Button variant="outline" className="mt-2" onClick={rotateImage}>
            <RotateCcw className="h-4 w-4 mr-2" /> Rotate
          </Button>
        </div>
      )}

      {selectedFile && (
        <Button onClick={handleUpload} disabled={isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...
            </>
          ) : (
            "Upload Now"
          )}
        </Button>
      )}
    </div>
  );
}
