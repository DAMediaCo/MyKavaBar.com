import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon } from "lucide-react";
import type { KavaBar } from "@db/schema";

interface Props {
  bar: KavaBar;
  isOwner: boolean;
}

export default function BarMediaManager({ bar, isOwner }: Props) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [virtualTourUrl, setVirtualTourUrl] = useState(bar.virtualTourUrl || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handlePhotoUrlAdd = async () => {
    if (!photoUrl) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a photo URL",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/kava-bars/${bar.id}/photos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: photoUrl,
          caption: photoCaption,
          isPrimary: false,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "Photo URL added successfully",
      });

      // Reset form and invalidate queries
      setPhotoUrl("");
      setPhotoCaption("");
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${bar.id}/photos`] });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVirtualTourUpdate = async () => {
    try {
      const response = await fetch(`/api/kava-bars/${bar.id}/virtual-tour`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          virtualTourUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "Virtual tour URL updated successfully",
      });

      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${bar.id}`] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  if (!isOwner) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Photos</CardTitle>
          <CardDescription>Add photos of your kava bar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photoUrl">Photo URL</Label>
            <Input
              id="photoUrl"
              placeholder="Enter photo URL"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photoCaption">Caption (optional)</Label>
            <Input
              id="photoCaption"
              placeholder="Enter photo caption"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <Button 
            onClick={handlePhotoUrlAdd}
            disabled={isSubmitting}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Add Photo URL
          </Button>

          {/* Preview area when URL is entered */}
          {photoUrl && !isSubmitting && (
            <div className="mt-4 p-4 border rounded-lg">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img 
                  src={photoUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = ""; // Clear the broken image
                    target.className = "hidden";
                    // Show error state
                    const parent = target.parentElement;
                    if (parent) {
                      const errorDiv = document.createElement('div');
                      errorDiv.className = "absolute inset-0 flex items-center justify-center";
                      errorDiv.innerHTML = `
                        <div class="text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">Invalid image URL</p>
                        </div>
                      `;
                      parent.appendChild(errorDiv);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Virtual Tour</CardTitle>
          <CardDescription>Add a virtual tour link for your kava bar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="virtualTourUrl">Virtual Tour URL</Label>
            <Input
              id="virtualTourUrl"
              placeholder="Enter virtual tour URL"
              value={virtualTourUrl}
              onChange={(e) => setVirtualTourUrl(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleVirtualTourUpdate}
            className="w-full"
          >
            Update Virtual Tour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}