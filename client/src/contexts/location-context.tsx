import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useLocationPreferences } from '@/hooks/use-location-preferences';

// Define the shape of our location context
interface LocationContextType {
  coordinates: { latitude: number; longitude: number } | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'manual' | 'preset';
  isLoading: boolean;
  radius: number;
  description: string | null;
  selectedPreset: string | null;
  requestLocation: () => Promise<void>;
  setManualLocation: (coordinates: { latitude: number; longitude: number }, description?: string, radius?: number) => void;
  selectPreset: (presetKey: string) => void;
  setRadius: (radius: number) => void;
  clearLocation: () => void;
}

// Create the context with a default value
const LocationContext = createContext<LocationContextType | null>(null);

// Provider component
export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const locationPrefs = useLocationPreferences();

  return (
    <LocationContext.Provider value={{
      coordinates: locationPrefs.coordinates,
      permissionStatus: locationPrefs.permissionStatus,
      isLoading: locationPrefs.isLoading,
      radius: locationPrefs.radius,
      description: locationPrefs.description,
      selectedPreset: locationPrefs.selectedPreset,
      requestLocation: locationPrefs.requestLocation,
      setManualLocation: locationPrefs.setManualLocation,
      selectPreset: locationPrefs.selectPreset,
      setRadius: locationPrefs.setRadius,
      clearLocation: locationPrefs.clearLocation,
    }}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use the location context
export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === null) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};