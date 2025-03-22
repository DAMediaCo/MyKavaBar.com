export function parseHours(hoursData: any) {
  return hoursData
    .filter(({ day, open, close }: any) => day && open && close) // Ensure valid data
    .map(({ day, open, close }: any) => {
      // Convert 24-hour format to 12-hour format
      const formatTime = (time: any) => {
        let [hour, minute] = time.split(":").map(Number);
        const period = hour >= 12 ? "PM" : "AM";
        if (hour > 12) hour -= 12; // Convert to 12-hour format
        if (hour === 0) hour = 12; // Handle midnight
        return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
      };

      // Format the open and close times
      const formattedOpen = formatTime(open);
      let formattedClose = formatTime(close);

      return `${day}: ${formattedOpen} – ${formattedClose}`;
    });
}
