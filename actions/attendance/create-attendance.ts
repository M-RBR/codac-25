'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth/auth';
import { 
    createAttendanceSchema, 
    type CreateAttendanceInput,
    attendanceDateSchema
} from '@/lib/validation/attendance';
import { 
    type ServerActionResult, 
    handlePrismaError 
} from '@/lib/server-action-utils';


// Define return type with Prisma's generated types
type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
    include: {
        student: {
            select: {
                id: true;
                name: true;
                email: true;
            };
        };
        cohort: {
            select: {
                id: true;
                name: true;
                slug: true;
            };
        };
    };
}>;

type CreateAttendanceResult = ServerActionResult<AttendanceWithRelations>;

export async function createAttendance(data: CreateAttendanceInput): Promise<CreateAttendanceResult> {
    const startTime = Date.now();

    try {
        logger.logServerAction('create', 'attendance', {
            metadata: { 
                studentId: data.studentId, 
                cohortId: data.cohortId,
                date: data.date.toISOString(),
                status: data.status
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
                error: 'Insufficient permissions. Only mentors and admins can manage attendance.'
            };
        }

        // Validate input data
        const validatedData = createAttendanceSchema.parse(data);
        
        // Validate that the date is a weekday
        attendanceDateSchema.parse(validatedData.date);

        // Verify that the student exists and belongs to the specified cohort
        const student = await prisma.user.findFirst({
            where: {
                id: validatedData.studentId,
                role: 'STUDENT',
                status: 'ACTIVE',
                cohortId: validatedData.cohortId,
            },
            select: { id: true, name: true, cohortId: true }
        });

        if (!student) {
            return {
                success: false,
                error: 'Student not found or not active in the specified cohort'
            };
        }

        // Verify that the cohort exists
        const cohort = await prisma.cohort.findUnique({
            where: { id: validatedData.cohortId },
            select: { id: true, name: true, startDate: true, endDate: true }
        });

        if (!cohort) {
            return {
                success: false,
                error: 'Cohort not found'
            };
        }

        // Check if attendance record already exists for this student and date
        const existingAttendance = await prisma.attendance.findUnique({
            where: {
                studentId_date: {
                    studentId: validatedData.studentId,
                    date: validatedData.date
                }
            }
        });

        if (existingAttendance) {
            return {
                success: false,
                error: 'Attendance record already exists for this student and date'
            };
        }

        // Create attendance record
        const attendance = await prisma.attendance.create({
            data: {
                date: validatedData.date,
                status: validatedData.status,
                studentId: validatedData.studentId,
                cohortId: validatedData.cohortId,
            },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                cohort: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        logger.logDatabaseOperation('create', 'attendance', attendance.id, {
            metadata: { 
                studentId: attendance.studentId,
                cohortId: attendance.cohortId,
                date: attendance.date.toISOString(),
                status: attendance.status
            }
        });

        // Revalidate relevant paths
        revalidatePath('/attendance');
        revalidatePath(`/attendance/${cohort.name.toLowerCase().replace(/\s+/g, '-')}`);

        const endTime = Date.now();
        logger.logServerAction('create', 'attendance', {
            metadata: {
                attendanceId: attendance.id,
                duration: endTime - startTime
            }
        });

        return {
            success: true,
            data: attendance
        };

    } catch (error) {
        const endTime = Date.now();
        logger.error('Failed to create attendance', error instanceof Error ? error : new Error(String(error)), {
            metadata: {
                studentId: data.studentId,
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
            error: 'Failed to create attendance record'
        };
    }
}
