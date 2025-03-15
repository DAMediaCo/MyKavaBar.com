import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const ImageWithFallback = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) => {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      // Check if src was moved to data-src
      const dataSrc = img.getAttribute("data-src");
      if (dataSrc && !img.src) {
        img.src = dataSrc;
      }

      // Create observer to watch for attribute changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-src") {
            const newDataSrc = img.getAttribute("data-src");
            if (newDataSrc) {
              img.src = newDataSrc;
            }
          }
        });
      });

      // Start observing
      observer.observe(img, { attributes: true });

      // Cleanup
      return () => observer.disconnect();
    }
  }, []);

  return <img ref={imgRef} src={src} alt={alt} className={className} />;
};

export default function ProfilePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queryClient = useQueryClient();

  // Fetch user data
  const { data: userProfile, isLoading: isLoadingUser } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const response = await fetch("/api/user");
      if (!response.ok) throw new Error("Failed to fetch user data");
      const data = await response.json();
      console.log("API Response:", data); // Debug log to see the actual response
      return data;
    },
  });

  useEffect(() => {
    if (userProfile?.user.profilePhotoUrl && !photoPreviewUrl) {
      console.log(
        "Setting initial profile photo URL:",
        userProfile.user.profilePhotoUrl,
      );
      setPhotoPreviewUrl(userProfile.user.profilePhotoUrl);
    }
  }, [userProfile]);

  // Clean up camera resources when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const updateProfile = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        body: data,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries([`/api/user`]);
      toast({
        title: "Profile Updated",
        description: "Your profile photo has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update profile",
      });
    },
  });

  const startCamera = async () => {
    try {
      setIsLoading(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in your browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!videoRef.current) {
        throw new Error("Video element not found");
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      await videoRef.current.play();
      setIsCameraActive(true);
      setIsLoading(false);
    } catch (error: any) {
      console.error("Camera error:", error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description:
          error.message || "Failed to start camera. Please try again.",
      });
      setShowCamera(false);
      setIsLoading(false);
    }
  };

  const handlePhotoCapture = async () => {
    setShowCamera(true);
    setTimeout(startCamera, 100);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !isCameraActive) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(videoRef.current, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error("Failed to create image");
          }
          const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
          setProfilePhoto(file);
          setPhotoPreviewUrl(URL.createObjectURL(blob));
          setShowCamera(false);
        },
        "image/jpeg",
        0.9,
      );
    } catch (error: any) {
      console.error("Photo capture error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "Failed to capture photo. Please try again.",
      });
    }
  };

  const handleSubmit = () => {
    if (profilePhoto) {
      const formData = new FormData();
      formData.append("profilePhoto", profilePhoto);
      updateProfile.mutate(formData);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update password");
      }

      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Update your profile photo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center space-y-4 md:space-y-0 flex-col md:flex-row  space-x-4">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted">
                  {photoPreviewUrl ? (
                    <ImageWithFallback
                      src={photoPreviewUrl}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : userProfile?.user.profilePhotoUrl ? (
                    <ImageWithFallback
                      src={userProfile.user.profilePhotoUrl}
                      alt="Current profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Camera className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePhotoCapture}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                  <div className="relative">
                    <Button type="button" variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Photo
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                      />
                    </Button>
                  </div>
                </div>
              </div>
              {profilePhoto && (
                <Button
                  onClick={handleSubmit}
                  className="w-full mt-4"
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Profile Photo"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button onClick={() => setShowPasswordForm(true)} variant="outline">
              Change Password
            </Button>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit">Update Password</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-lg">
            <div className="aspect-video bg-black">
              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Activating camera...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCamera(false)}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                disabled={!isCameraActive}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
