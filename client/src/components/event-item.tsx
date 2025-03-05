
import { Event } from "@/types";
import { format, parseISO } from "date-fns";
import { CalendarIcon, ClockIcon, Trash, PencilIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface EventItemProps {
  event: Event;
  onEdit?: (event: Event) => void;
  onDelete?: (eventId: number) => void;
  isEditable?: boolean;
}

export function EventItem({ event, onEdit, onDelete, isEditable = false }: EventItemProps) {
  // Format date as "Day, Month Date"
  const formattedDate = format(parseISO(event.date), "EEEE, MMMM d");
  
  // Format start and end times in 12-hour format
  const formattedStartTime = format(parseISO(event.startTime), "h:mm a");
  const formattedEndTime = format(parseISO(event.endTime), "h:mm a");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{event.title}</CardTitle>
          {event.isRecurring && (
            <Badge variant="outline">Recurring</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{event.description}</p>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
            <span className="text-sm">{formattedDate}</span>
          </div>
          <div className="flex items-center">
            <ClockIcon className="mr-2 h-4 w-4 opacity-70" />
            <span className="text-sm">{formattedStartTime} - {formattedEndTime}</span>
          </div>
        </div>
      </CardContent>
      {isEditable && (
        <CardFooter className="flex justify-end gap-2">
          {onEdit && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(event)}
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => onDelete(event.id)}
            >
              <Trash className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
