export interface Event {
  id: number;
  barId: number;
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  isRecurring?: boolean;
  dayOfWeek?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventWithBar extends Event {
  bar?: {
    id: number;
    name: string;
  } | null;
}
