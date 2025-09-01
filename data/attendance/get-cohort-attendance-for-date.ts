'use server';

import { UserRole, AttendanceStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { type ServerActionResult } from '@/lib/server-action-utils';
import { auth } from '@/lib/auth/auth';

export type StudentWithAttendance = {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    attendance: {
        id: string;
        status: AttendanceStatus;
    } | null;
};

export type GetCohortAttendanceForDateResult = ServerActionResult<{
    students: StudentWithAttendance[];
    date: Date;
    cohortId: string;
    isEditable: boolean; // whether the date is within the 30-day edit window
}>;

export async function getCohortAttendanceForDate(
    cohortSlug: string, 
    date: Date
): Promise<GetCohortAttendanceForDateResult> {
    const startTime = Date.now();

    try {
        logger.info('Fetching cohort attendance for specific date', {
            action: 'get',
            resource: 'cohort_attendance_date',
            metadata: { cohortSlug, date: date.toISOString() },
        });

        const session = await auth();
        if (!session?.user?.id || (session.user.role !== UserRole.MENTOR && session.user.role !== UserRole.ADMIN)) {
            return {
                success: false,
                error: 'Unauthorized: Only mentors and admins can view attendance.',
            };
        }

        // First, get the cohort to verify it exists and get its ID
        const cohort = await prisma.cohort.findUnique({
            where: { slug: cohortSlug },
            select: { id: true, name: true },
        });

        if (!cohort) {
            return {
                success: false,
                error: 'Cohort not found.',
            };
        }

        // Get students with their attendance for the specific date
        const students = await prisma.user.findMany({
            where: {
                cohortId: cohort.id,
                role: UserRole.STUDENT,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                attendanceRecords: {
                    where: {
                        date: date,
                        cohortId: cohort.id,
                    },
                    select: {
                        id: true,
                        status: true,
                    },
                    take: 1, // Should only be one record per student per date
                },
            },
            orderBy: {
                name: 'asc',
            },
        });

        logger.logDatabaseOperation('findMany', 'users', undefined, {
            metadata: { 
                cohortId: cohort.id, 
                date: date.toISOString(), 
                studentsCount: students.length, 
                purpose: 'attendance_by_date' 
            }
        });

        // Transform the data to match our expected format
        const studentsWithAttendance: StudentWithAttendance[] = students.map(student => ({
            id: student.id,
            name: student.name || 'Unknown Student',
            email: student.email || '',
            avatar: student.avatar,
            attendance: student.attendanceRecords.length > 0 ? student.attendanceRecords[0] : null,
        }));

        // Check if the date is within the 30-day editable window
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const isEditable = date >= thirtyDaysAgo && date <= today;

        logger.info('Cohort attendance for date retrieved successfully', {
            metadata: {
                action: 'get',
                resource: 'cohort_attendance_date',
                duration: Date.now() - startTime,
                cohortId: cohort.id,
                studentsCount: studentsWithAttendance.length,
                attendanceRecordsCount: studentsWithAttendance.filter(s => s.attendance).length,
                isEditable,
            }
        });

        return {
            success: true,
            data: {
                students: studentsWithAttendance,
                date,
                cohortId: cohort.id,
                isEditable,
            },
        };

    } catch (error) {
        logger.error('Failed to get cohort attendance for date', error instanceof Error ? error : new Error(String(error)), {
            metadata: {
                action: 'get',
                resource: 'cohort_attendance_date',
                duration: Date.now() - startTime,
                cohortSlug,
                date: date.toISOString(),
            }
        });
        return { success: false, error: 'Failed to load attendance data for the selected date.' };
    }
}
