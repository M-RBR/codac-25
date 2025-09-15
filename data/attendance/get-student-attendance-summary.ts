'use server';

import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { UserRole, UserStatus } from '@prisma/client';
import type { ServerActionResult } from '@/lib/server-action-utils';
import { withAttendanceViewAuth } from '@/lib/auth/attendance-middleware';
import { z } from 'zod';

// Input validation schema
const getStudentAttendanceSummarySchema = z.object({
    cohortId: z.string().min(1, 'Cohort ID is required'),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
});

type GetStudentAttendanceSummaryInput = z.infer<typeof getStudentAttendanceSummarySchema>;

// Return types
interface StudentAttendanceSummary {
    id: string;
    name: string;
    email: string | null;
    avatar?: string | null;
    attendanceStats: {
        present: number;
        absentSick: number;
        absentExcused: number;
        absentUnexcused: number;
        unrecorded: number;
        totalDays: number;
    };
}

type GetStudentAttendanceSummaryResult = ServerActionResult<{
    students: StudentAttendanceSummary[];
    totalWorkingDays: number;
    cohortInfo: {
        id: string;
        name: string;
        startDate: Date;
        endDate: Date | null;
    };
}>;

// Internal implementation without auth (auth handled by middleware)
const getStudentAttendanceSummaryInternal = cache(async (
    data: GetStudentAttendanceSummaryInput
): Promise<GetStudentAttendanceSummaryResult> => {
    const requestStart = Date.now();
    
    try {
        // Validate input
        const validatedData = getStudentAttendanceSummarySchema.parse(data);
        const { cohortId, startDate, endDate } = validatedData;

        // Get cohort information
        const cohort = await prisma.cohort.findUnique({
            where: { id: cohortId },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
            }
        });

        if (!cohort) {
            logger.error('Cohort not found for attendance summary', new Error('Cohort not found'), {
                metadata: { 
                    action: 'get',
                    resource: 'student_attendance_summary',
                    cohortId 
                }
            });
            return {
                success: false,
                error: 'Cohort not found'
            };
        }

        // Calculate date range
        const queryStartDate = startDate || cohort.startDate;
        const queryEndDate = endDate || cohort.endDate || new Date();

        // Calculate total working days (excluding weekends)
        const totalWorkingDays = calculateWorkingDays(queryStartDate, queryEndDate);

        // Get all active students in the cohort
        const students = await prisma.user.findMany({
            where: {
                cohortId,
                role: UserRole.STUDENT,
                status: UserStatus.ACTIVE
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                attendanceRecords: {
                    where: {
                        cohortId,
                        date: {
                            gte: queryStartDate,
                            lte: queryEndDate
                        }
                    },
                    select: {
                        status: true,
                        date: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Process attendance data for each student
        const studentsWithStats: StudentAttendanceSummary[] = students.map(student => {
            // Count attendance by status
            const present = student.attendanceRecords.filter(r => r.status === 'PRESENT').length;
            const absentSick = student.attendanceRecords.filter(r => r.status === 'ABSENT_SICK').length;
            const absentExcused = student.attendanceRecords.filter(r => r.status === 'ABSENT_EXCUSED').length;
            const absentUnexcused = student.attendanceRecords.filter(r => r.status === 'ABSENT_UNEXCUSED').length;
            
            const totalRecorded = present + absentSick + absentExcused + absentUnexcused;
            const unrecorded = Math.max(0, totalWorkingDays - totalRecorded);

            return {
                id: student.id,
                name: student.name || 'Unknown',
                email: student.email,
                avatar: student.avatar,
                attendanceStats: {
                    present,
                    absentSick,
                    absentExcused,
                    absentUnexcused,
                    unrecorded,
                    totalDays: totalWorkingDays
                }
            };
        });

        const duration = Date.now() - requestStart;
        
        logger.info('Successfully fetched student attendance summary', {
            action: 'get',
            resource: 'student_attendance_summary',
            metadata: { 
                cohortId,
                studentsCount: studentsWithStats.length,
                totalWorkingDays,
                duration 
            }
        });

        return {
            success: true,
            data: {
                students: studentsWithStats,
                totalWorkingDays,
                cohortInfo: {
                    id: cohort.id,
                    name: cohort.name,
                    startDate: cohort.startDate,
                    endDate: cohort.endDate
                }
            }
        };

    } catch (error) {
        const duration = Date.now() - requestStart;
        
        logger.error('Failed to fetch student attendance summary', error instanceof Error ? error : new Error(String(error)), {
            metadata: { 
                action: 'get',
                resource: 'student_attendance_summary',
                duration 
            }
        });

        return {
            success: false,
            error: 'Failed to fetch student attendance summary'
        };
    }
});

// Helper function to calculate working days (excluding weekends)
function calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

// Export the secured version wrapped with middleware
export const getStudentAttendanceSummary = withAttendanceViewAuth(
    getStudentAttendanceSummaryInternal,
    {
        logResource: 'student_summary',
        extractCohortId: (data: GetStudentAttendanceSummaryInput) => data.cohortId
    }
);

