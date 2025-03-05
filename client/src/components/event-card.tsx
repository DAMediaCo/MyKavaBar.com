
import { CalendarIcon, ClockIcon, IconProps } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Event } from "@/types";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  onEditClick?: (event: Event) => void;
  onDeleteClick?: (eventId: number) => void;
  isOwner?: boolean;
  compact?: boolean;
  className?: string;
}

export function EventCard({ 
  event, 
  onEditClick, 
  onDeleteClick, 
  isOwner = false, 
  compact = false,
  className 
}: EventCardProps) {
  // Format date as "Day, Month Date"
  const formattedDate = format(parseISO(event.date), "EEEE, MMMM d");
  
  // Format start and end times in 12-hour format (e.g., "7:30 PM")
  const formattedStartTime = format(parseISO(event.startTime), "h:mm a");
  const formattedEndTime = format(parseISO(event.endTime), "h:mm a");
  
  const isMultiDay = event.isMultiDay;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className={cn("pb-3", compact && "p-4")}>
        <div className="flex justify-between items-start">
          <CardTitle className={cn("line-clamp-2", compact && "text-base")}>
            {event.title}
          </CardTitle>
          {event.isRecurring && (
            <Badge variant="outline" className="ml-2">Recurring</Badge>
          )}
        </div>
        <CardDescription className="mt-1.5">
          {event.description && !compact ? event.description : null}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("pb-3", compact && "px-4 py-2")}>
        <div className="flex flex-col space-y-2 text-sm">
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="mr-2 h-4 w-4 opacity-70" />
            <span>
              {formattedStartTime} - {formattedEndTime}
            </span>
          </div>
        </div>
      </CardContent>
      {isOwner && !compact && (
        <CardFooter className={cn("flex justify-between pt-0", compact && "px-4 pb-4")}>
          {onEditClick && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEditClick(event)}
              className="text-xs"
            >
              Edit
            </Button>
          )}
          {onDeleteClick && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => onDeleteClick(event.id)}
              className="text-xs"
            >
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
