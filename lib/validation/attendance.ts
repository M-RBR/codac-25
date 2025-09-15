import { z } from 'zod';

// Import the shared type
export type { ServerActionResult } from '@/lib/server-action-utils';

// Attendance status enum validation
export const attendanceStatusSchema = z.enum([
  'PRESENT',
  'ABSENT_SICK',
  'ABSENT_EXCUSED',
  'ABSENT_UNEXCUSED'
]);

// Base attendance validation schema
export const attendanceSchema = z.object({
  date: z.date(),
  status: attendanceStatusSchema,
  studentId: z.string().cuid('Invalid student ID'),
  cohortId: z.string().cuid('Invalid cohort ID'),
});

// Create attendance schema
export const createAttendanceSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .transform((dateStr) => new Date(dateStr)),
    /*
    .transform((dateStr) => {
      // Convert string to Date object at start of day in local timezone
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed
    }),
    */ 
  status: attendanceStatusSchema,
  studentId: z.string().cuid('Invalid student ID'),
  cohortId: z.string().cuid('Invalid cohort ID'),
});

// Update attendance schema
export const updateAttendanceSchema = z.object({
  id: z.string().cuid('Invalid attendance ID'),
  status: attendanceStatusSchema,
});

// Get attendance schema for filtering
export const getAttendanceSchema = z.object({
  cohortId: z.string().cuid('Invalid cohort ID'),
  date: z.date(),
  studentId: z.string().cuid('Invalid student ID'),
});

// Date range validation with weekday constraint
export const dateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: "End date must be after or equal to start date",
    path: ["endDate"],
  }
);

// Validation for checking if date is a weekday
export const weekdaySchema = z.date().refine(
  (date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday (1) to Friday (5)
  },
  {
    message: "Attendance can only be recorded for weekdays (Monday-Friday)",
  }
);

// Validation for checking if date is within the last 30 days
export const editableDateSchema = z.date().refine(
  (date) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return date >= thirtyDaysAgo && date <= today;
  },
  {
    message: "Attendance can only be modified for dates within the last 30 days",
  }
);

// Combined schema for attendance date validation
export const attendanceDateSchema = z.date()
  .refine(
    (date) => {
      const dayOfWeek = date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    },
    {
      message: "Attendance can only be recorded for weekdays (Monday-Friday)",
    }
  );

// Schema for editing existing attendance with date restrictions
export const editAttendanceDateSchema = z.date()
  .refine(
    (date) => {
      const dayOfWeek = date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    },
    {
      message: "Attendance can only be recorded for weekdays (Monday-Friday)",
    }
  )
  .refine(
    (date) => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= thirtyDaysAgo && date <= today;
    },
    {
      message: "Attendance can only be modified for dates within the last 30 days",
    }
  );

// Type exports
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type GetAttendanceInput = z.infer<typeof getAttendanceSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
