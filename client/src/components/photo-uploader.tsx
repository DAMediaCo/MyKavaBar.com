import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  barId: number;
  onSuccess?: () => void;
}

export function PhotoUploader({ barId, onSuccess }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Check file size (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 25MB",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);
    try {
      setIsUploading(true);

      const response = await fetch(`/api/bars/${barId}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        console.log("Response doesn't seems to be okay");
        throw new Error(await response.text());
      }

      // Notify the bar owner about the new photo

      // const notifyResponse = await fetch(`/api/bars/${barId}/notify`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     type: "photo_upload",
      //     message: "A new photo has been uploaded to your bar",
      //   }),
      //   credentials: "include",
      // });

      // if (!notifyResponse.ok) {
      //   console.error(
      //     "Failed to send notification:",
      //     await notifyResponse.text(),
      //   );
      // }
      if (onSuccess) {
        onSuccess();
      }
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });

      // Clear the input
      event.target.value = "";

      // Call the success callback
      // if (onSuccess) {
      //   await onSuccess();
      // }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      console.log("Image upload done");
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="photo-upload"
        disabled={isUploading}
      />
      <label htmlFor="photo-upload">
        <Button disabled={isUploading} asChild>
          <span>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </>
            )}
          </span>
        </Button>
      </label>
    </div>
  );
}
