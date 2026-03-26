export interface CallWindowConfig {
  startHour: number;   // e.g. 10 for 10:00 AM
  startMinute: number; // e.g. 0
  endHour: number;     // e.g. 18 for 6:00 PM
  endMinute: number;   // e.g. 0
  allowSaturday: boolean;
  allowSunday: boolean;
}

export const DEFAULT_CALL_WINDOW: CallWindowConfig = {
  startHour: 10,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  allowSaturday: false,
  allowSunday: false,
};

/** Minutes from midnight for a given hour+minute */
function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** Convert any Date to its Eastern Time components */
function toET(date: Date): { hours: number; minutes: number; dayOfWeek: number; timeInMinutes: number } {
  const etString = date.toLocaleString("en-US", { timeZone: "America/New_York" });
  const etDate = new Date(etString);
  return {
    hours: etDate.getHours(),
    minutes: etDate.getMinutes(),
    dayOfWeek: etDate.getDay(), // 0=Sun, 1=Mon, ..., 6=Sat
    timeInMinutes: etDate.getHours() * 60 + etDate.getMinutes(),
  };
}

function isDayAllowed(dayOfWeek: number, config: CallWindowConfig): boolean {
  if (dayOfWeek === 0) return config.allowSunday;
  if (dayOfWeek === 6) return config.allowSaturday;
  return true; // Mon–Fri always allowed
}

export function validateCallTime(
  scheduledAt: Date,
  config: CallWindowConfig = DEFAULT_CALL_WINDOW
): { valid: boolean; reason?: string } {
  const now = new Date();
  const diffMinutes = (scheduledAt.getTime() - now.getTime()) / (1000 * 60);

  if (diffMinutes < 3) {
    return { valid: false, reason: "Call must be scheduled at least 3 minutes in the future." };
  }

  const { timeInMinutes, dayOfWeek } = toET(scheduledAt);
  const windowStart = toMinutes(config.startHour, config.startMinute);
  const windowEnd = toMinutes(config.endHour, config.endMinute);

  if (!isDayAllowed(dayOfWeek, config)) {
    const dayName = dayOfWeek === 0 ? "Sunday" : "Saturday";
    return { valid: false, reason: `Calls are not scheduled on ${dayName}.` };
  }

  if (timeInMinutes < windowStart) {
    return { valid: false, reason: `Calls cannot be made before ${config.startHour}:${String(config.startMinute).padStart(2, "0")} AM ET.` };
  }

  if (timeInMinutes >= windowEnd) {
    return { valid: false, reason: `Calls cannot be made after ${config.endHour > 12 ? config.endHour - 12 : config.endHour}:${String(config.endMinute).padStart(2, "0")} PM ET.` };
  }

  return { valid: true };
}

/**
 * Given a proposed time, return the next valid call time respecting the window and weekend rules.
 * Advances day-by-day if needed until a valid day/time is found.
 */
export function getNextValidCallTime(
  from: Date,
  config: CallWindowConfig = DEFAULT_CALL_WINDOW
): Date {
  const windowStart = toMinutes(config.startHour, config.startMinute);
  const windowEnd = toMinutes(config.endHour, config.endMinute);

  // Work with a mutable copy (in UTC ms)
  let candidate = new Date(from);

  // Safety: max 14 days of iteration to avoid infinite loops
  for (let i = 0; i < 14 * 48; i++) {
    const { timeInMinutes, dayOfWeek } = toET(candidate);

    // If this day is not allowed, jump to start of next day
    if (!isDayAllowed(dayOfWeek, config)) {
      candidate = advanceToNextDayStart(candidate, config);
      continue;
    }

    // Before window — jump to window start today
    if (timeInMinutes < windowStart) {
      const minutesToAdd = windowStart - timeInMinutes;
      candidate = new Date(candidate.getTime() + minutesToAdd * 60 * 1000);
      // Re-check day in case DST weirdness
      continue;
    }

    // After window — jump to window start next valid day
    if (timeInMinutes >= windowEnd) {
      candidate = advanceToNextDayStart(candidate, config);
      continue;
    }

    // Valid!
    return candidate;
  }

  // Fallback: return original (should never reach here)
  return from;
}

/** Advance to windowStart on the next calendar day (ET), skipping disallowed days */
function advanceToNextDayStart(from: Date, config: CallWindowConfig): Date {
  const { timeInMinutes } = toET(from);
  const windowStart = toMinutes(config.startHour, config.startMinute);
  // Minutes remaining in today + minutes to reach window start tomorrow
  const minutesUntilMidnight = 1440 - timeInMinutes;
  const next = new Date(from.getTime() + (minutesUntilMidnight + windowStart) * 60 * 1000);
  return next;
}
