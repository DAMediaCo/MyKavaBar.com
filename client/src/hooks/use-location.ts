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
    const saved = localStorage.getItem("lastKnownLocation");
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionState | null>(null);
  const { toast } = useToast();
  const hasShownErrorToast = useRef(false);

  // Refs to manage state
  const retryCount = useRef(0);
  const isRequesting = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownInitialToast = useRef(false);
  const hasCheckedPermissions = useRef(false);

  // Only check permissions on mount
  useEffect(() => {
    if (!hasCheckedPermissions.current) {
      checkPermissions();
      hasCheckedPermissions.current = true;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  const checkPermissions = async () => {
    if (!navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser";
      setError(msg);
      toast({
        variant: "destructive",
        title: "Location Not Supported",
        description: msg,
      });
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({
          name: "geolocation",
        });
        setPermissionStatus(permission.state);

        // Listen for permission changes
        permission.addEventListener("change", () => {
          setPermissionStatus(permission.state);
          // Only request location if permission becomes granted and we don't have coordinates
          if (permission.state === "granted" && !coordinates) {
            retryCount.current = 0;
            requestLocation();
          }
        });

        // Request location immediately if permission is granted and we don't have coordinates
        if (permission.state === "granted" && !coordinates) {
          requestLocation();
        }
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const requestLocation = async () => {
    // Prevent multiple simultaneous requests
    if (isRequesting.current) {
      return;
    }

    isRequesting.current = true;
    setIsLoading(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 300000, // Cache for 5 minutes
          });
        },
      );

      const newCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      // Only update if coordinates have changed significantly or are not set
      const hasSignificantChange =
        !coordinates ||
        Math.abs(coordinates.latitude - newCoordinates.latitude) > 0.0001 ||
        Math.abs(coordinates.longitude - newCoordinates.longitude) > 0.0001;

      if (hasSignificantChange) {
        setCoordinates(newCoordinates);
        localStorage.setItem(
          "lastKnownLocation",
          JSON.stringify(newCoordinates),
        );

        // Show success toast only on first successful location fetch
        if (!hasShownInitialToast.current) {
          toast({
            title: "Location Found",
            description: "Showing kava bars near you.",
          });
          hasShownInitialToast.current = true;
        }
      }

      setError(null);
      retryCount.current = 0;
    } catch (error) {
      handleLocationError(error);
    } finally {
      setIsLoading(false);
      isRequesting.current = false;
    }
  };

  const handleLocationError = (error: any) => {
    console.error("Location error:", error);
    let message =
      "Unable to retrieve your location. Distance-based features will be limited.";

    if (error.code === 1) {
      message =
        "Location access was denied. Please enable it in your browser settings.";
    } else if (error.code === 2) {
      message = "Location unavailable. Please try again.";
    } else if (error.code === 3) {
      message = "Location request timed out. Please try again.";
    }

    setError(message);

    // Show error toast only once per session
    if (!hasShownErrorToast.current) {
      toast({
        variant: "destructive",
        title: "Location Error",
        description: message,
      });
      hasShownErrorToast.current = true;
    }
  };

  return { coordinates, isLoading, error, permissionStatus, requestLocation };
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
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
