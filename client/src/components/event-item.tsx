import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventWithBar } from '@/types/events';
import { parseISO } from 'date-fns'; // Added to parse ISO 8601 strings

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
  // Ensure correct date is displayed by using proper date parsing and handling potential timezone issues
  const getFormattedDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';

    try {
      // Simply take the date string as is and display directly
      // The dateString format should be YYYY-MM-DD from the form
      const [year, month, day] = dateString.split('-');
      
      // Create a formatted date string manually without timezone conversion
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = parseInt(month, 10) - 1;
      return `${monthNames[monthIndex]} ${parseInt(day, 10)}, ${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
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
                {getFormattedDate(event.startDate)}
              </Badge>
            )
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {format(parseISO(`1970-01-01T${event.startTime}`), 'h:mm a')} -
          {format(parseISO(`1970-01-01T${event.endTime}`), 'h:mm a')}
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