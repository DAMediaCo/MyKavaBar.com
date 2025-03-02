import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users, Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCrowdDensity } from "@/hooks/use-crowd-density";

interface CrowdTrackerProps {
  barId: number;
  className?: string;
}

export default function CrowdTracker({ barId, className }: CrowdTrackerProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentDensity, updateDensity, isConnected } = useCrowdDensity(barId);

  // Determine status and color based on level
  const getStatus = () => {
    if (!currentDensity) return { 
      text: "No Reports Yet", 
      color: "bg-secondary", 
      range: "Unknown",
      icon: User
    };

    const ranges = {
      low: "1-4 people",
      medium: "5-8 people",
      high: "9-15 people",
      very_high: "15+ people"
    };

    switch (currentDensity.level) {
      case 'low':
        return { 
          text: "Quiet", 
          color: "bg-green-500", 
          range: ranges.low,
          icon: User
        };
      case 'medium':
        return { 
          text: "Moderate", 
          color: "bg-yellow-500", 
          range: ranges.medium,
          icon: Users
        };
      case 'high':
        return { 
          text: "Busy", 
          color: "bg-orange-500", 
          range: ranges.high,
          icon: Users
        };
      case 'very_high':
        return { 
          text: "Very Busy", 
          color: "bg-red-500", 
          range: ranges.very_high,
          icon: Users
        };
      default:
        return { 
          text: "Unknown", 
          color: "bg-secondary", 
          range: "Unknown",
          icon: User
        };
    }
  };

  const { text, color, range, icon: StatusIcon } = getStatus();

  // Function to update crowd level
  const handleUpdateCrowd = async (level: 'low' | 'medium' | 'high' | 'very_high') => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to report crowd levels",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateDensity(level);
      toast({
        title: "Thank you for your report",
        description: "You've helped keep others informed about the current crowd level!",
      });
    } catch (error: any) {
      toast({
        title: "Error updating crowd level",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Trigger animation periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("p-4 border rounded-lg space-y-4", className)}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">Current Crowd Level</h3>
          <p className="text-sm text-muted-foreground mt-1">
            User-reported • {currentDensity ? 
              new Date(currentDensity.timestamp).toLocaleTimeString() : 
              'No reports yet'}
          </p>
        </div>
        {!isConnected && (
          <span className="text-xs text-destructive">
            (Offline)
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: currentDensity?.level === 'low' ? '25%' : 
                           currentDensity?.level === 'medium' ? '50%' :
                           currentDensity?.level === 'high' ? '75%' : 
                           currentDensity?.level === 'very_high' ? '100%' : '0%' }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className="h-5 w-5" />
          <span className="font-medium">{text}</span>
          <span className="text-sm text-muted-foreground">
            ({range})
          </span>
        </div>
        <AnimatePresence>
          {currentDensity && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              <span>Reported</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Update buttons */}
      {user && (
        <>
          <div className="text-sm text-muted-foreground mt-4 mb-2">
            Help others - report the current crowd level:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateCrowd('low')}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "1-4 People"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateCrowd('medium')}
              disabled={isUpdating}
            >
              5-8 People
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateCrowd('high')}
              disabled={isUpdating}
            >
              9-15 People
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateCrowd('very_high')}
              disabled={isUpdating}
            >
              15+ People
            </Button>
          </div>
        </>
      )}
    </div>
  );
}