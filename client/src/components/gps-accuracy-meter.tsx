import { Progress } from "@/components/ui/progress";
import { Signal, Target } from "lucide-react";

interface GPSAccuracyMeterProps {
  accuracy: number; // in meters
}

export default function GPSAccuracyMeter({ accuracy }: GPSAccuracyMeterProps) {
  // Convert accuracy to a 0-100 scale
  // Consider accuracy <= 10m as excellent (100%), >= 100m as poor (0%)
  const accuracyScore = Math.max(0, Math.min(100, (1 - (accuracy - 10) / 90) * 100));
  
  const getAccuracyLevel = () => {
    if (accuracy <= 10) return { label: "Excellent", color: "bg-green-500" };
    if (accuracy <= 30) return { label: "Good", color: "bg-blue-500" };
    if (accuracy <= 60) return { label: "Fair", color: "bg-yellow-500" };
    return { label: "Poor", color: "bg-red-500" };
  };

  const { label, color } = getAccuracyLevel();

  return (
    <div className="flex items-center space-x-2 bg-card p-2 rounded-lg">
      <Signal className="h-4 w-4" />
      <div className="flex-1 space-y-1">
        <div className="flex justify-between text-sm">
          <span>GPS Accuracy: {label}</span>
          <span className="text-muted-foreground">±{Math.round(accuracy)}m</span>
        </div>
        <Progress value={accuracyScore} className={color} />
      </div>
      <Target className="h-4 w-4" />
    </div>
  );
}
