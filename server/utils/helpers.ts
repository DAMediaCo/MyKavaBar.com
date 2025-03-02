/**
 * Utility functions for server-side operations
 */

/**
 * Sleep/delay function that returns a promise that resolves after the specified time
 * @param ms Time to sleep in milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Formats a date to ISO string without milliseconds
 * @param date Date to format
 */
export const formatDate = (date: Date): string =>
  date.toISOString().split('.')[0] + 'Z';
