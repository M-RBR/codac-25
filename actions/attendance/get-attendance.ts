'use server';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth/auth';
import { 
    getAttendanceSchema, 
    type GetAttendanceInput
} from '@/lib/validation/attendance';
import { 
    type ServerActionResult, 
    handlePrismaError 
} from '@/lib/server-action-utils';


// Define return types with Prisma's generated types
type AttendanceWithStudent = Prisma.AttendanceGetPayload<{
    include: {
        student: {
            select: {
                id: true;
                name: true;
                email: true;
                avatar: true;
            };
        };
    };
}>;

type GetAttendanceResult = ServerActionResult<{
    attendance: AttendanceWithStudent[];
    totalRecords: number;
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
}>;

export async function getAttendance(data: GetAttendanceInput): Promise<GetAttendanceResult> {
    const startTime = Date.now();

    try {
        logger.logServerAction('read', 'attendance', {
            metadata: { 
                cohortId: data.cohortId,
                studentId: data.studentId,
                startDate: data.startDate?.toISOString(),
                endDate: data.endDate?.toISOString()
            }
        });

        // Get authenticated user and check permissions
        const session = await auth();
        if (!session?.user?.id) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }

        // Check if user has MENTOR or ADMIN role
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        if (!user || (user.role !== 'MENTOR' && user.role !== 'ADMIN')) {
            return {
                success: false,
                error: 'Insufficient permissions. Only mentors and admins can view attendance.'
            };
        }

        // Validate input data
        const validatedData = getAttendanceSchema.parse(data);

        // Verify that the cohort exists
        const cohort = await prisma.cohort.findUnique({
            where: { id: validatedData.cohortId },
            select: { 
                id: true, 
                name: true, 
                startDate: true, 
                endDate: true 
            }
        });

        if (!cohort) {
            return {
                success: false,
                error: 'Cohort not found'
            };
        }

        // Set default date range if not provided
        const startDate = validatedData.startDate || cohort.startDate;
        const endDate = validatedData.endDate || cohort.endDate || new Date();

        // Build where clause for attendance query
        const whereClause: Prisma.AttendanceWhereInput = {
            cohortId: validatedData.cohortId,
            date: {
                gte: startDate,
                lte: endDate
            }
        };

        // Add student filter if specified
        if (validatedData.studentId) {
            whereClause.studentId = validatedData.studentId;
        }

        // Get attendance records with student information
        const attendance = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
            },
            orderBy: [
                { date: 'desc' },
                { student: { name: 'asc' } }
            ]
        });

        // Get total count for pagination if needed
        const totalRecords = await prisma.attendance.count({
            where: whereClause
        });

        logger.logDatabaseOperation('read', 'attendance', `cohort-${cohort.id}`, {
            metadata: { 
                cohortId: validatedData.cohortId,
                recordCount: attendance.length,
                totalRecords,
                dateRange: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            }
        });

        const endTime = Date.now();
        logger.logServerAction('read', 'attendance', {
            metadata: {
                cohortId: validatedData.cohortId,
                duration: endTime - startTime,
                recordCount: attendance.length
            }
        });

        return {
            success: true,
            data: {
                attendance,
                totalRecords,
                dateRange: {
                    startDate,
                    endDate
                }
            }
        };

    } catch (error) {
        const endTime = Date.now();
        logger.error('Failed to get attendance', error instanceof Error ? error : new Error(String(error)), {
            metadata: {
                cohortId: data.cohortId,
                duration: endTime - startTime
            }
        });

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return {
                success: false,
                error: handlePrismaError(error)
            };
        }

        return {
            success: false,
            error: 'Failed to get attendance records'
        };
    }
}
