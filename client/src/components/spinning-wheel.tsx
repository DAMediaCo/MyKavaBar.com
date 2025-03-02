import { useState, useEffect, useRef } from "react";
import { useLocation, calculateDistance } from "@/hooks/use-location";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import type { KavaBar } from "@db/schema";
import { Link } from "wouter";

interface Props {
  bars: KavaBar[];
}

function getComputedCSSColor(variable: string, opacity: number = 1): string {
  const style = getComputedStyle(document.documentElement);
  const hsl = style.getPropertyValue(variable).trim();
  const [h, s, l] = hsl.split(' ');
  return `hsla(${h}, ${s}, ${l}, ${opacity})`;
}

export default function SpinningWheel({ bars }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { coordinates } = useLocation();
  const [radius, setRadius] = useState([5]); // Default 5 miles radius
  const [filteredBars, setFilteredBars] = useState<KavaBar[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedBar, setSelectedBar] = useState<KavaBar | null>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const { toast } = useToast();

  // Filter bars based on distance
  useEffect(() => {
    if (coordinates && bars.length > 0) {
      const filtered = bars.filter(bar => {
        if (!bar.location) return false;
        const distance = calculateDistance(
          coordinates.latitude,
          coordinates.longitude,
          bar.location.lat,
          bar.location.lng
        );
        return distance <= radius[0];
      });
      setFilteredBars(filtered);
      drawWheel(0); // Redraw wheel when bars are filtered
    }
  }, [coordinates, bars, radius]);

  // Initialize wheel on mount and when canvas reference changes
  useEffect(() => {
    if (canvasRef.current) {
      drawWheel(currentRotation);
    }
  }, [canvasRef, currentRotation]);

  const drawWheel = (rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas || filteredBars.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 20;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save the context state and move to center
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);

    // Get theme colors
    const primaryColor = getComputedCSSColor('--primary', 0.2);
    const primaryColorFade = getComputedCSSColor('--primary', 0.1);
    const secondaryColor = getComputedCSSColor('--secondary', 0.2);
    const secondaryColorFade = getComputedCSSColor('--secondary', 0.1);
    const borderColor = getComputedCSSColor('--border');
    const foregroundColor = getComputedCSSColor('--foreground');
    const backgroundColor = getComputedCSSColor('--background');

    // Draw segments
    const arcSize = (2 * Math.PI) / filteredBars.length;
    filteredBars.forEach((bar, index) => {
      const startAngle = index * arcSize;
      const endAngle = (index + 1) * arcSize;

      // Create gradient for each segment
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
      if (index % 2 === 0) {
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, primaryColorFade);
      } else {
        gradient.addColorStop(0, secondaryColor);
        gradient.addColorStop(1, secondaryColorFade);
      }

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, outerRadius, startAngle, endAngle);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Add bar name
      ctx.save();
      ctx.rotate(startAngle + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = foregroundColor;
      ctx.font = '14px var(--font-sans)';

      // Shorten text if too long
      const displayName = bar.name.length > 20 ?
        bar.name.substring(0, 17) + '...' :
        bar.name;

      // Add shadow for better readability
      ctx.shadowColor = backgroundColor;
      ctx.shadowBlur = 4;
      ctx.fillText(displayName, outerRadius - 30, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, 2 * Math.PI);
    ctx.fillStyle = backgroundColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw inner circle decoration
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, 2 * Math.PI);
    ctx.fillStyle = getComputedCSSColor('--primary');
    ctx.fill();

    ctx.restore();

    // Draw fixed pointer
    ctx.beginPath();
    ctx.moveTo(centerX, 35);
    ctx.lineTo(centerX - 15, 10);
    ctx.lineTo(centerX + 15, 10);
    ctx.closePath();
    ctx.fillStyle = getComputedCSSColor('--primary');
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const spinWheel = () => {
    if (filteredBars.length === 0) {
      toast({
        variant: "destructive",
        title: "No Bars Found",
        description: "No kava bars found within the selected radius. Try increasing the distance.",
      });
      return;
    }

    setIsSpinning(true);
    const randomIndex = Math.floor(Math.random() * filteredBars.length);
    const spinDuration = 4000; // 4 seconds
    const totalSpins = 5; // Number of full rotations

    // Calculate final rotation
    const segmentSize = 360 / filteredBars.length;
    const segmentOffset = -segmentSize / 2;
    const selectedAngle = (randomIndex * segmentSize) + segmentOffset;
    const finalRotation = (totalSpins * 360) + selectedAngle - 90;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Custom easing function for smooth deceleration
      const easeOut = (t: number) => {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      };

      const currentDegrees = finalRotation * easeOut(progress);
      setCurrentRotation(currentDegrees);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setSelectedBar(filteredBars[randomIndex]);
      }
    };

    animate();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          Not sure where to go? Spin the wheel!
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kava Bar Roulette</DialogTitle>
          <DialogDescription>
            Adjust the radius and spin the wheel to discover a random kava bar near you!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Distance Radius: {radius[0]} miles</label>
            <Slider
              value={radius}
              onValueChange={setRadius}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          <div className="relative aspect-square max-w-md mx-auto">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="w-full h-full rounded-full shadow-lg border-2 border-border"
            />
          </div>

          <div className="flex justify-center">
            <Button
              onClick={spinWheel}
              disabled={isSpinning || filteredBars.length === 0}
              className="px-8 py-2 text-lg font-medium relative overflow-hidden"
            >
              {isSpinning ? (
                <span className="inline-flex items-center">
                  Spinning
                  <span className="ml-2 animate-[bounce_1s_infinite]">.</span>
                  <span className="animate-[bounce_1s_infinite_.2s]">.</span>
                  <span className="animate-[bounce_1s_infinite_.4s]">.</span>
                </span>
              ) : (
                "Spin the Wheel"
              )}
            </Button>
          </div>

          {selectedBar && (
            <Link href={`/kava-bars/${selectedBar.id}`}>
              <div className="p-6 border-2 border-primary/20 rounded-lg bg-card hover:bg-accent/5 transition-colors cursor-pointer">
                <h3 className="font-semibold text-xl mb-3">Selected Bar:</h3>
                <p className="text-lg font-medium text-primary">{selectedBar.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedBar.address}</p>
                <p className="text-sm text-primary mt-4 font-medium">
                  Click to view details →
                </p>
              </div>
            </Link>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {filteredBars.length} bars found within {radius[0]} miles
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}