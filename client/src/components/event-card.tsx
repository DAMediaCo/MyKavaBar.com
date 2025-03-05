import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Event } from '@/types/events';

interface EventCardProps {
  event: {
    id: number;
    title: string;
    description: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    timezone?: string;
  };
  onEdit?: (event: any) => void;
  onDelete?: (id: number) => void;
  isOwner?: boolean;
}

export function EventCard({ event, onEdit, onDelete, isOwner = false }: EventCardProps) {
  // Format dates for display
  const formatDate = (dateString: string) => {
    // Parse the date exactly as stored without timezone adjustments
    if (!dateString) return '';

    // Split the date string to get year, month, day
    const [year, month, day] = dateString.split('-').map(num => parseInt(num));

    // Create a date object with these values
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
    <Card className={isOwner ? 'border-red-500' : ''}>
      <CardContent className="p-4">
        <div className="flex flex-col">
          <h3 className="font-medium">{event.title}</h3>
          {event.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {event.description}
            </p>
          )}
          <p className="text-sm mt-2">
            {event.startDate ? `${formatDate(event.startDate)}, ` : ''}
            {formatTime(event.startTime)} - {formatTime(event.endTime)}
          </p>
          {isOwner && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onEdit && onEdit(event)}
                className="text-xs bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete && onDelete(event.id)}
                className="text-xs bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}