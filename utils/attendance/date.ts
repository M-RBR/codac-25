import { isAfter, isWeekend, startOfDay, subDays } from "date-fns";

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

// Helper function to get a valid weekday (skip weekends)
export function getValidAttendanceDate(dateInput?: string): Date {
    let targetDate: Date;

    if (dateInput) {
        // ✅ FIX: Use local timezone consistently (same as validation schema)
        const [year, month, day] = dateInput.split('-').map(Number);
        targetDate = new Date(year, month - 1, day); // month is 0-indexed, creates local date

        // Validate the date
        if (isNaN(targetDate.getTime())) {
            targetDate = new Date(); // Fallback to a new local date if invalid
        }
    } else {
        targetDate = new Date();
    }

    // Always normalize to start of day FIRST using date-fns
    // Now operating on local timezone date (consistent with validation)
    targetDate = startOfDay(targetDate);

    // If it's a weekend, go back to the previous Friday
    while (isWeekend(targetDate)) {
        targetDate = startOfDay(subDays(targetDate, 1));
    }

    // Ensure it's not in the future (comparing calendar days using date-fns)
    const todayStart = startOfDay(new Date());

    if (isAfter(targetDate, todayStart)) {
        targetDate = todayStart;
        // If today is a weekend, go back to the previous Friday
        while (isWeekend(targetDate)) {
            targetDate = startOfDay(subDays(targetDate, 1));
        }
    }

    return targetDate;
}

