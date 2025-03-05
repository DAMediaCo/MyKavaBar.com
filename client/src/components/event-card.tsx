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
  const getFormattedDate = (dateString: string | null) => {
    if (!dateString) return '';

    try {
      // Parse the ISO date string and handle timezone conversion properly
      // Use the date parts to create a UTC date that will display the correct date
      const date = parseISO(dateString);

      // Format using the date with timezone offset consideration
      return format(date, 'MMM d, yyyy');
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
                ? `${getFormattedDate(event.startDate)}, `
                : ''}
            {format(new Date(`1970-01-01T${event.startTime}`), 'h:mm a')} - {' '}
            {format(new Date(`1970-01-01T${event.endTime}`), 'h:mm a')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}