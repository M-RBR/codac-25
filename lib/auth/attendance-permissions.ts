import { UserRole } from '@prisma/client';

// Permission definitions for attendance features
export const ATTENDANCE_PERMISSIONS = {
    VIEW_ATTENDANCE: 'view_attendance',
    EDIT_ATTENDANCE: 'edit_attendance',
    VIEW_ALL_COHORTS: 'view_all_cohorts',
    VIEW_COHORT_STATISTICS: 'view_cohort_statistics',
    EXPORT_ATTENDANCE_DATA: 'export_attendance_data',
    MANAGE_ATTENDANCE_SETTINGS: 'manage_attendance_settings'
} as const;

export type AttendancePermission = typeof ATTENDANCE_PERMISSIONS[keyof typeof ATTENDANCE_PERMISSIONS];

// Role to permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, AttendancePermission[]> = {
    [UserRole.ADMIN]: [
        ATTENDANCE_PERMISSIONS.VIEW_ATTENDANCE,
        ATTENDANCE_PERMISSIONS.EDIT_ATTENDANCE,
        ATTENDANCE_PERMISSIONS.VIEW_ALL_COHORTS,
        ATTENDANCE_PERMISSIONS.VIEW_COHORT_STATISTICS,
        ATTENDANCE_PERMISSIONS.EXPORT_ATTENDANCE_DATA,
        ATTENDANCE_PERMISSIONS.MANAGE_ATTENDANCE_SETTINGS
    ],
    [UserRole.MENTOR]: [
        ATTENDANCE_PERMISSIONS.VIEW_ATTENDANCE,
        ATTENDANCE_PERMISSIONS.EDIT_ATTENDANCE,
        ATTENDANCE_PERMISSIONS.VIEW_ALL_COHORTS,
        ATTENDANCE_PERMISSIONS.VIEW_COHORT_STATISTICS
    ],
    [UserRole.STUDENT]: [],
    [UserRole.ALUMNI]: []
};

// Enhanced authentication context interface
export interface AttendanceAuthContext {
    userId: string;
    userRole: UserRole;
    userStatus: import('@prisma/client').UserStatus;
    permissions: AttendancePermission[];
    cohortIds: string[]; // Cohorts the user has access to
}
