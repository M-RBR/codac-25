import { isAfter, isWeekend, startOfDay } from "date-fns";

// Helper function to determine if a date should be disabled in the calendar
export function isDateDisabled(date: Date): boolean {
    const today = startOfDay(new Date());

    // Disable weekends
    if (isWeekend(date)) {
        return true;
    }

    // Disable future dates
    if (isAfter(date, today)) {
        return true;
    }

    return false;
}