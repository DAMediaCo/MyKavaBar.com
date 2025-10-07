import React, { useState } from "react";
import { Button } from "@/components/ui/button"; // Adjust path as per your project structure
import { FaApple } from "react-icons/fa";

const AppleButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const handleAppleLogin = () => {
    setIsLoading(true);
    window.location.href = "/api/auth/apple";
  };

  return (
    <Button
      variant="outline"
      onClick={handleAppleLogin}
      disabled={isLoading}
      className="flex items-center gap-2 w-full mt-3"
    >
      <FaApple className="w-5 h-5" /> {/* 20px = 5 units in tailwind */}
      Continue with Apple
    </Button>
  );
};

export default AppleButton;
