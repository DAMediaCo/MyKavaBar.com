import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import type { KavaBar } from "@db/schema";
import { PhotoUploader } from "./photo-uploader";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";

interface Props {
  bar: KavaBar;
}

interface Photo {
  id: number;
  url: string;
  width?: number;
  height?: number;
  photoReference?: string;
}

export default function BarPhotoGallery({ bar }: Props) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user-uploaded photos
  const { data: userPhotos = [], isLoading: isPhotosLoading } = useQuery<
    Photo[]
  >({
    queryKey: [`/api/bars/${bar.id}/photos`],
    queryFn: async () => {
      console.log("Fetching photos for bar:", {
        barId: bar.id,
        isAuthenticated: !!user,
      });

      const response = await fetch(`/api/bars/${bar.id}/photos`);
      if (!response.ok) {
        throw new Error("Failed to fetch photos");
      }
      const photos = await response.json();
      const processedPhotos = photos.map((photo: Photo) => ({
        ...photo,
        url: photo.url.startsWith("http")
          ? photo.url
          : `${window.location.origin}${photo.url}`,
      }));

      console.log("Fetched user photos:", {
        count: processedPhotos.length,
        isAuthenticated: !!user,
      });

      return processedPhotos;
    },
  });

  // Transform Google Photos into our Photo type
  const googlePhotos: Photo[] = (bar.googlePhotos || []).map((photo) => ({
    id: -1, // Use negative ID to distinguish from user photos
    url: `/api/photos/${photo.photoReference}?maxwidth=800`,
    width: photo.width,
    height: photo.height,
    photoReference: photo.photoReference,
  }));

  const allPhotos: Photo[] = [...userPhotos, ...googlePhotos];
  console.log("Total photos available:", {
    userPhotosCount: userPhotos.length,
    googlePhotosCount: googlePhotos.length,
    totalPhotos: allPhotos.length,
    isAuthenticated: !!user,
  });

  const handleDeletePhoto = async (photoId: number) => {
    try {
      const response = await fetch(`/api/bars/${bar.id}/photos/${photoId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({
        queryKey: [`/api/bars/${bar.id}/photos`],
      });

      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete photo",
      });
    }
  };

  const handleUploadSuccess = async () => {
    // Invalidate and refetch photos
    await queryClient.invalidateQueries({
      queryKey: [`/api/bars/${bar.id}/photos`],
    });
  };

  if (isPhotosLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-48 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Show photos regardless of login status */}
      {allPhotos.length > 0 && (
        <>
          <Card className="relative overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-video">
                <img
                  src={allPhotos[currentPhotoIndex].url}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                {allPhotos.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between p-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentPhotoIndex((i) => Math.max(0, i - 1))
                      }
                      disabled={currentPhotoIndex === 0}
                      className="bg-background/80 backdrop-blur-sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentPhotoIndex((i) =>
                          Math.min(allPhotos.length - 1, i + 1),
                        )
                      }
                      disabled={currentPhotoIndex === allPhotos.length - 1}
                      className="bg-background/80 backdrop-blur-sm"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {allPhotos.length > 1 && (
            <div className="grid grid-cols-6 gap-2">
              {allPhotos.map((photo, index) => (
                <div
                  key={photo.id || photo.photoReference}
                  className="relative"
                >
                  <button
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`relative aspect-square overflow-hidden rounded-md ${
                      index === currentPhotoIndex ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  {user?.isAdmin && photo.id > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo.id);
                      }}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                      title="Delete photo"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Only show upload option for logged-in users */}
      {!user ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Want to share your photos?</h3>
              <p className="text-muted-foreground mb-4">
                Log in or create an account to upload photos.
              </p>
              <Button asChild>
                <a href="/auth" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Log In to Upload Photos
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <PhotoUploader barId={bar.id} onSuccess={handleUploadSuccess} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
