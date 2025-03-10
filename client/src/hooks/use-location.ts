import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
}

type PermissionState = "granted" | "denied" | "prompt";

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

export function useLocation() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(() => {
    // Load cached location on initialization
    const saved = localStorage.getItem('lastKnownLocation');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);
  const { toast } = useToast();

  // Refs to manage state
  const retryCount = useRef(0);
  const isRequesting = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownInitialToast = useRef(false);
  const hasCheckedPermissions = useRef(false);
  const hasAutoRequested = useRef(false);

  // Check permissions on mount
  useEffect(() => {
    if (!hasCheckedPermissions.current) {
      console.log("Initializing location services...");
      checkPermissions();
      hasCheckedPermissions.current = true;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Function to manually check permissions
  const checkPermissions = async () => {
    console.log("Checking location permissions...");
    try {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser");
        setError("Geolocation is not supported by this browser");
        return false;
      }

      // Check permissions API if available
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        console.log("Permission status:", result.state);
        setPermissionStatus(result.state);

        // Listen for permission changes
        result.addEventListener('change', () => {
          console.log("Permission changed to:", result.state);
          setPermissionStatus(result.state);
        });

        return result.state === 'granted';
      }

      return true; // No permissions API, assume we can try
    } catch (err) {
      console.error("Error checking permissions:", err);
      return false;
    }
  };

  // Function to request location with improved error handling
  const requestLocation = () => {
    if (isRequesting.current) {
      console.log("Location request already in progress");
      return;
    }

    console.log("Requesting location...");
    setIsLoading(true);
    isRequesting.current = true;

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      setIsLoading(false);
      isRequesting.current = false;
      toast({
        title: "Location Error",
        description: "Geolocation is not supported by this browser",
        variant: "destructive"
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location acquired:", position.coords);
        const newCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        // Save to state and localStorage
        setCoordinates(newCoordinates);
        localStorage.setItem('lastKnownLocation', JSON.stringify(newCoordinates));

        setIsLoading(false);
        isRequesting.current = false;
        setError(null);
        retryCount.current = 0;

        toast({
          title: "Location updated",
          description: "Your location has been successfully updated",
        });
      },
      (err) => {
        console.error("Geolocation error:", err.code, err.message);

        let errorMessage = "Unknown error acquiring location";
        if (err.code === 1) {
          errorMessage = "Location permission denied";
        } else if (err.code === 2) {
          errorMessage = "Location unavailable";
        } else if (err.code === 3) {
          errorMessage = "Location request timed out";
        }

        setError(errorMessage);
        setIsLoading(false);
        isRequesting.current = false;

        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Accept positions up to 1 minute old
      }
    );
  };

  return {
    coordinates,
    isLoading,
    error,
    permissionStatus,
    requestLocation,
    checkPermissions
  };
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d * 0.621371; // Convert to miles
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}