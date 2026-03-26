export function validateCallTime(scheduledAt: Date): {
  valid: boolean;
  reason?: string;
} {
  const now = new Date();
  const diffMs = scheduledAt.getTime() - now.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes < 3) {
    return {
      valid: false,
      reason: "Call must be scheduled at least 3 minutes in the future.",
    };
  }

  // Convert to Eastern Time
  const etString = scheduledAt.toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const etDate = new Date(etString);
  const hours = etDate.getHours();
  const minutes = etDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // 10:30 AM ET = 630 minutes
  if (timeInMinutes < 630) {
    return {
      valid: false,
      reason: "Calls cannot be made before 10:30 AM Eastern Time.",
    };
  }

  // 8:00 PM ET = 1200 minutes
  if (timeInMinutes >= 1200) {
    return {
      valid: false,
      reason: "Calls cannot be made after 8:00 PM Eastern Time.",
    };
  }

  return { valid: true };
}

export function getNextValidCallTime(from: Date): Date {
  const etString = from.toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const etDate = new Date(etString);
  const hours = etDate.getHours();
  const minutes = etDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (timeInMinutes < 630) {
    // Before 10:30 AM — schedule for 10:30 AM same day
    const next = new Date(from);
    const diff = 630 - timeInMinutes;
    next.setMinutes(next.getMinutes() + diff);
    return next;
  }

  if (timeInMinutes >= 1200) {
    // After 8 PM — schedule for 10:30 AM next day
    const next = new Date(from);
    const minutesUntilMidnight = 1440 - timeInMinutes;
    next.setMinutes(next.getMinutes() + minutesUntilMidnight + 630);
    return next;
  }

  return from;
}
