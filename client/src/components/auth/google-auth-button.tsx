import React, { useState } from "react";
import { Button } from "@/components/ui/button"; // Adjust path as per your project structure
import { FcGoogle } from "react-icons/fc";

const GoogleButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const handleGoogleLogin = () => {
    setIsLoading(true);
    window.location.href = "/api/auth/google";
  };

  return (
    <Button
      variant="outline"
      onClick={handleGoogleLogin}
      disabled={isLoading}
      className="flex items-center gap-2 w-full mt-3"
    >
      <FcGoogle className="w-5 h-5" /> {/* 20px = 5 units in tailwind */}
      Continue with Google
    </Button>
  );
};

export default GoogleButton;
