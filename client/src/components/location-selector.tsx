import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { MapPin, X, Info, Locate, MapIcon, LocateFixed } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PRESET_LOCATIONS } from '@/hooks/use-location-preferences';
import { useLocationContext } from '@/contexts/location-context';

const LocationSelector: React.FC = () => {
  const location = useLocationContext();
  const { toast } = useToast();
  const [customLatitude, setCustomLatitude] = useState('');
  const [customLongitude, setCustomLongitude] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [manualRadius, setManualRadius] = useState(25);
  const [activeTab, setActiveTab] = useState('preset');

  // Handle requesting location permissions
  const handleGetCurrentLocation = async () => {
    try {
      await location.requestLocation();
      toast({
        title: "Location Access Granted",
        description: "Using your current location for search results.",
      });
    } catch (error) {
      toast({
        title: "Location Access Denied",
        description: "Please enable location services or use a preset location.",
        variant: "destructive",
      });
    }
  };

  // Handle selecting a preset location
  const handleSelectPreset = (presetKey: string) => {
    location.selectPreset(presetKey);
    toast({
      title: "Location Updated",
      description: `Showing results near ${PRESET_LOCATIONS[presetKey as keyof typeof PRESET_LOCATIONS].description}`,
    });
  };

  // Handle setting a custom location
  const handleSubmitCustomLocation = () => {
    try {
      const lat = parseFloat(customLatitude);
      const lng = parseFloat(customLongitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid coordinates');
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('Coordinates out of range');
      }

      location.setManualLocation(
        { latitude: lat, longitude: lng }, 
        customDescription || 'Custom Location',
        manualRadius
      );

      toast({
        title: "Custom Location Set",
        description: `Now searching within ${manualRadius} miles of your custom location.`,
      });

      // Reset form
      setCustomLatitude('');
      setCustomLongitude('');
      setCustomDescription('');
      setManualRadius(25);
      
      // Switch to preset tab for clarity
      setActiveTab('preset');
    } catch (error) {
      toast({
        title: "Invalid Coordinates",
        description: "Please enter valid latitude (-90 to 90) and longitude (-180 to 180) values.",
        variant: "destructive",
      });
    }
  };

  // Handle radius change
  const handleRadiusChange = (value: number[]) => {
    location.setRadius(value[0]);
  };

  // Handle resetting location preferences
  const handleResetLocation = () => {
    location.clearLocation();
    toast({
      title: "Location Reset",
      description: "Your location preferences have been cleared.",
    });
  };

  // Content based on current state
  let statusContent;
  if (location.coordinates) {
    statusContent = (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Current Location</h4>
            <p className="text-sm text-muted-foreground">{location.description || 'Location set'}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleResetLocation}
          >
            <X className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="radius">Search Radius: {location.radius} miles</Label>
          </div>
          <Slider
            id="radius"
            defaultValue={[location.radius]}
            max={100}
            min={5}
            step={5}
            onValueChange={handleRadiusChange}
          />
        </div>
      </div>
    );
  } else if (location.isLoading) {
    statusContent = (
      <div className="flex items-center justify-center py-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 bg-muted rounded-full mb-2"></div>
          <div className="h-4 bg-muted rounded w-32 mb-1"></div>
          <div className="h-3 bg-muted rounded w-24"></div>
        </div>
      </div>
    );
  } else {
    statusContent = (
      <div className="p-1">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preset">Preset Locations</TabsTrigger>
            <TabsTrigger value="custom">Custom Coordinates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preset" className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={handleGetCurrentLocation}
              >
                <Locate className="h-4 w-4 mr-2" />
                My Location
              </Button>
              
              <Select onValueChange={handleSelectPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a city" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESET_LOCATIONS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-xs text-muted-foreground">
              <p>Select "My Location" to use your current position, or choose a preset city.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="custom" className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  placeholder="e.g. 28.5383"
                  value={customLatitude}
                  onChange={(e) => setCustomLatitude(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  placeholder="e.g. -81.3792"
                  value={customLongitude}
                  onChange={(e) => setCustomLongitude(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g. My Home"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="manual-radius">Search Radius: {manualRadius} miles</Label>
              <Slider
                id="manual-radius"
                defaultValue={[manualRadius]}
                max={100}
                min={5}
                step={5}
                onValueChange={(value) => setManualRadius(value[0])}
              />
            </div>
            
            <Button onClick={handleSubmitCustomLocation}>Set Custom Location</Button>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle>Location Settings</CardTitle>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">About Location Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Your location is used to find kava bars near you. 
                  We only access your location when you explicitly choose to share it.
                </p>
                <p className="text-sm text-muted-foreground">
                  All location preferences are stored locally on your device.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <CardDescription>
          Find kava bars in your area
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusContent}
      </CardContent>
    </Card>
  );
};

export default LocationSelector;