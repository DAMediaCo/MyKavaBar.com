import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventWithBar } from '@/types/events';
// import { parseISO } from 'date-fns'; // Removed as it's already imported above

interface EventItemProps {
  event: EventWithBar;
  showBarName?: boolean;
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
}

const formatDay = (day: number | null) => {
  if (day === null) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
};

export function EventItem({ event, showBarName = false, onDelete, isDeleting = false }: EventItemProps) {
  // Format dates for display
  const formatDate = (dateStr: string) => {
    try {
      // Log the date being formatted
      console.log(`Formatting date in event-item: ${dateStr}`);

      // Parse the date without any time components to avoid timezone shifts
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
      // Month is 0-indexed in JavaScript Date
      const date = new Date(year, month - 1, day);
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      // Convert 24 hour time like "21:00" to "9:00 PM"
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12
      return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeStr;
    }
  };

  return (
    <div className="flex justify-between items-start border-b pb-3 last:border-0 mb-3 last:mb-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium">{event.title}</h3>
          {event.isRecurring ? (
            <Badge variant="secondary">{formatDay(event.dayOfWeek)}</Badge>
          ) : (
            event.startDate && (
              <Badge variant="secondary">
                {formatDate(event.startDate)}
              </Badge>
            )
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatTime(event.startTime)} - {formatTime(event.endTime)}
        </div>
        {event.description && <p className="text-sm mt-1">{event.description}</p>}
        {showBarName && event.bar && (
          <p className="text-xs text-muted-foreground mt-1">at {event.bar.name}</p>
        )}
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(event.id)}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}