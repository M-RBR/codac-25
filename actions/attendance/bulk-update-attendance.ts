'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withAttendanceEditAuth } from '@/lib/auth/attendance-middleware';
import { 
    bulkUpdateAttendanceSchema, 
    type BulkUpdateAttendanceInput,
    attendanceDateSchema
} from '@/lib/validation/attendance';
import { 
    type ServerActionResult, 
    handlePrismaError 
} from '@/lib/server-action-utils';


// Define return type for bulk operations
type BulkAttendanceResult = {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
};

type BulkUpdateAttendanceResult = ServerActionResult<BulkAttendanceResult>;

// Internal implementation without auth (auth handled by middleware)
async function bulkUpdateAttendanceInternal(data: BulkUpdateAttendanceInput): Promise<BulkUpdateAttendanceResult> {
    const startTime = Date.now();

    try {
        // Safely handle date for logging (before validation transforms it)
        const logDate = typeof data.date === 'string' 
            ? data.date 
            : data.date.toISOString();

        logger.logServerAction('bulk_update', 'attendance', {
            metadata: { 
                cohortId: data.cohortId,
                date: logDate,
                recordCount: data.attendanceRecords.length
            }
        });

        // Validate input data
        const validatedData = bulkUpdateAttendanceSchema.parse(data);
        
        // Validate that the date is a weekday
        attendanceDateSchema.parse(validatedData.date);

        // Verify that the cohort exists
        const cohort = await prisma.cohort.findUnique({
            where: { id: validatedData.cohortId },
            select: { id: true, name: true, slug: true }
        });

        if (!cohort) {
            return {
                success: false,
                error: 'Cohort not found'
            };
        }

        // Get all students in the cohort to validate the student IDs
        const cohortStudents = await prisma.user.findMany({
            where: {
                cohortId: validatedData.cohortId,
                role: 'STUDENT',
                status: 'ACTIVE'
            },
            select: { id: true, name: true }
        });

        const cohortStudentIds = new Set(cohortStudents.map(s => s.id));

        // Get existing attendance records for this date and cohort
        const existingAttendance = await prisma.attendance.findMany({
            where: {
                date: validatedData.date,
                cohortId: validatedData.cohortId
            },
            select: { studentId: true, id: true, status: true }
        });

        const existingAttendanceMap = new Map(
            existingAttendance.map(a => [a.studentId, a])
        );

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Process each attendance record in a transaction
        await prisma.$transaction(async (tx) => {
            for (const record of validatedData.attendanceRecords) {
                try {
                    // Validate that the student belongs to this cohort
                    if (!cohortStudentIds.has(record.studentId)) {
                        errors.push(`Student ${record.studentId} is not an active member of this cohort`);
                        skipped++;
                        continue;
                    }

                    const existingRecord = existingAttendanceMap.get(record.studentId);

                    if (existingRecord) {
                        // Update existing record if status has changed
                        if (existingRecord.status !== record.status) {
                            await tx.attendance.update({
                                where: { id: existingRecord.id },
                                data: { 
                                    status: record.status,
                                    updatedAt: new Date()
                                }
                            });
                            updated++;
                        } else {
                            skipped++;
                        }
                    } else {
                        // Create new record
                        await tx.attendance.create({
                            data: {
                                date: validatedData.date,
                                status: record.status,
                                studentId: record.studentId,
                                cohortId: validatedData.cohortId
                            }
                        });
                        created++;
                    }
                } catch (recordError) {
                    const errorMessage = recordError instanceof Error ? recordError.message : String(recordError);
                    errors.push(`Failed to process attendance for student ${record.studentId}: ${errorMessage}`);
                    skipped++;
                }
            }
        });

        const result: BulkAttendanceResult = {
            created,
            updated,
            skipped,
            errors
        };

        logger.logDatabaseOperation('bulk_update', 'attendance', `cohort-${cohort.id}`, {
            metadata: { 
                cohortId: validatedData.cohortId,
                date: validatedData.date.toISOString(),
                ...result
            }
        });

        // Revalidate relevant paths
        revalidatePath('/attendance');
        revalidatePath(`/attendance/${cohort.slug}`);

        const endTime = Date.now();
        logger.logServerAction('bulk_update', 'attendance', {
            metadata: {
                cohortId: validatedData.cohortId,
                duration: endTime - startTime,
                ...result
            }
        });

        return {
            success: true,
            data: result
        };

    } catch (error) {
        const endTime = Date.now();
        logger.error('Failed to bulk update attendance', error instanceof Error ? error : new Error(String(error)), {
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
            error: 'Failed to bulk update attendance records'
        };
    }
}

// Export the secured version wrapped with middleware
export const bulkUpdateAttendance = withAttendanceEditAuth(
    bulkUpdateAttendanceInternal,
    {
        extractCohortId: (data: BulkUpdateAttendanceInput) => data.cohortId,
        extractDate: (data: BulkUpdateAttendanceInput) => data.date,
        logResource: 'bulk_update',
        getResourceId: (data: BulkUpdateAttendanceInput) => {
            // Handle both string and Date inputs safely
            const dateStr = typeof data.date === 'string' 
                ? data.date 
                : data.date.toISOString().split('T')[0];
            return `${data.cohortId}-${dateStr}`;
        }
    }
);
