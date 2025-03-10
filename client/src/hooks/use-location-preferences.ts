import { useState, useEffect, useCallback } from 'react';

// Local storage key for saving preferences
const LOCATION_PREF_KEY = 'mykavabar-location-prefs';

// Define preset locations for quick selection
export const PRESET_LOCATIONS = {
  'Orlando': { latitude: 28.5383, longitude: -81.3792, description: 'Orlando, FL', radius: 25 },
  'Miami': { latitude: 25.7617, longitude: -80.1918, description: 'Miami, FL', radius: 25 },
  'Tampa': { latitude: 27.9506, longitude: -82.4572, description: 'Tampa, FL', radius: 25 },
  'Jacksonville': { latitude: 30.3322, longitude: -81.6557, description: 'Jacksonville, FL', radius: 25 },
  'Brevard': { latitude: 28.2619, longitude: -80.7214, description: 'Brevard County, FL', radius: 25 },
  'Palm Beach': { latitude: 26.7056, longitude: -80.0364, description: 'Palm Beach, FL', radius: 25 },
  'Fort Lauderdale': { latitude: 26.1224, longitude: -80.1373, description: 'Fort Lauderdale, FL', radius: 25 },
  'Tallahassee': { latitude: 30.4383, longitude: -84.2807, description: 'Tallahassee, FL', radius: 25 },
};

// Default location if the user declines to share their location
export const DEFAULT_LOCATION = { 
  latitude: 28.5383, 
  longitude: -81.3792, 
  description: 'Orlando, FL', 
  radius: 50
};

// Types
type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'manual' | 'preset';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationState {
  coordinates: Coordinates | null;
  permissionStatus: LocationPermissionStatus;
  isLoading: boolean;
  selectedPreset: string | null;
  radius: number;
  description: string | null;
}

// Local storage key for saving preferences
const LOCATION_PREF_KEY = 'kavabar_location_preferences';

// Helper to save preferences to local storage
const saveLocationPreferences = (state: LocationState) => {
  try {
    localStorage.setItem(LOCATION_PREF_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save location preferences:', error);
  }
};

export function useLocationPreferences() {
  // Initialize state
  const [state, setState] = useState<LocationState>(() => {
    // Try to load from local storage first
    try {
      const savedPrefs = localStorage.getItem(LOCATION_PREF_KEY);
      if (savedPrefs) {
        return JSON.parse(savedPrefs) as LocationState;
      }
    } catch (error) {
      console.error('Failed to load location preferences:', error);
    }

    // Default state if nothing in local storage
    return {
      coordinates: null,
      permissionStatus: 'prompt',
      isLoading: false,
      selectedPreset: null,
      radius: 25,
      description: null
    };
  });

  // Request location permission and get coordinates
  const requestLocation = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser.');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const newState = {
        coordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        permissionStatus: 'granted' as LocationPermissionStatus,
        isLoading: false,
        selectedPreset: null,
        radius: state.radius,
        description: 'My Location'
      };

      setState(newState);
      saveLocationPreferences(newState);
    } catch (error) {
      console.error('Error getting location:', error);
      
      // Set permission denied state if that's the error
      if (error instanceof GeolocationPositionError && error.code === error.PERMISSION_DENIED) {
        setState(prev => ({ 
          ...prev, 
          permissionStatus: 'denied',
          isLoading: false 
        }));
      } else {
        // For other errors, just stop loading
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [state.radius]);

  // Set a manual location (coordinates + optional description)
  const setManualLocation = useCallback((coordinates: Coordinates, description?: string, radius?: number) => {
    const newState = {
      coordinates,
      permissionStatus: 'manual' as LocationPermissionStatus,
      isLoading: false,
      selectedPreset: null,
      radius: radius || state.radius,
      description: description || 'Custom Location'
    };
    
    setState(newState);
    saveLocationPreferences(newState);
  }, [state.radius]);

  // Select a preset location
  const selectPreset = useCallback((presetKey: string) => {
    const preset = PRESET_LOCATIONS[presetKey as keyof typeof PRESET_LOCATIONS];
    if (!preset) return;

    const newState = {
      coordinates: {
        latitude: preset.latitude,
        longitude: preset.longitude
      },
      permissionStatus: 'preset' as LocationPermissionStatus,
      isLoading: false,
      selectedPreset: presetKey,
      radius: preset.radius,
      description: preset.description
    };
    
    setState(newState);
    saveLocationPreferences(newState);
  }, []);

  // Update the search radius
  const setRadius = useCallback((radius: number) => {
    setState(prev => {
      const newState = { ...prev, radius };
      saveLocationPreferences(newState);
      return newState;
    });
  }, []);

  // Clear location data
  const clearLocation = useCallback(() => {
    setState({
      coordinates: null,
      permissionStatus: 'prompt',
      isLoading: false,
      selectedPreset: null,
      radius: 25,
      description: null
    });
    localStorage.removeItem(LOCATION_PREF_KEY);
  }, []);

  return {
    ...state,
    requestLocation,
    setManualLocation,
    selectPreset,
    setRadius,
    clearLocation
  };
}