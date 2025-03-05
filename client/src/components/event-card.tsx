import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Event } from '@/types/events';

interface EventCardProps {
  event: Event;
  className?: string;
}

const daysOfWeek = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function EventCard({ event, className = '' }: EventCardProps) {
  // Ensure correct date is displayed by using proper date parsing
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';

    try {
      // Parse the ISO date string and ensure we show the intended date
      const date = parseISO(dateString);

      // Ensure we display the date as stored in UTC without local timezone adjustment
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();

      // Create a date object with the UTC components
      const displayDate = new Date(year, month, day);

      // Format using the correct date
      return format(displayDate, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex flex-col">
          <h3 className="font-medium">{event.title}</h3>
          {event.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {event.description}
            </p>
          )}
          <p className="text-sm mt-2">
            {event.isRecurring 
              ? `${daysOfWeek[event.dayOfWeek!]}, `
              : event.startDate 
                ? `${formatDate(event.startDate)}, `
                : ''}
            {format(new Date(`1970-01-01T${event.startTime}`), 'h:mm a')} - {' '}
            {format(new Date(`1970-01-01T${event.endTime}`), 'h:mm a')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}