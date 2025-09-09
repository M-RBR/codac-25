import { AttendanceStatus } from '@prisma/client';
import { isWeekend, format, parseISO } from 'date-fns';
import { getWorkingDaysBetween } from './attendance-calculations';

/**
 * Utility functions for bulk attendance operations and batch processing
 */

// Bulk operation types
export interface BulkAttendanceRecord {
    studentId: string;
    date: Date;
    status: AttendanceStatus;
    metadata?: {
        reason?: string;
        notes?: string;
        createdBy?: string;
        source?: 'manual' | 'import' | 'system';
    };
}

export interface BulkOperationResult {
    success: boolean;
    totalRecords: number;
    processedRecords: number;
    createdRecords: number;
    updatedRecords: number;
    skippedRecords: number;
    failedRecords: number;
    errors: Array<{
        recordIndex: number;
        studentId: string;
        date: string;
        error: string;
    }>;
    warnings: Array<{
        recordIndex: number;
        studentId: string;
        date: string;
        warning: string;
    }>;
    summary: {
        duration: number;
        recordsPerSecond: number;
    };
}

export interface BulkValidationResult {
    valid: boolean;
    errors: Array<{
        recordIndex: number;
        field: string;
        value: any;
        error: string;
    }>;
    warnings: Array<{
        recordIndex: number;
        field: string;
        value: any;
        warning: string;
    }>;
    statistics: {
        totalRecords: number;
        validRecords: number;
        invalidRecords: number;
        duplicateRecords: number;
        weekendRecords: number;
        futureRecords: number;
    };
}

/**
 * Validate bulk attendance records before processing
 */
export function validateBulkAttendanceRecords(
    records: BulkAttendanceRecord[],
    cohortStartDate: Date,
    cohortEndDate?: Date | null,
    validStudentIds?: Set<string>
): BulkValidationResult {
    const errors: BulkValidationResult['errors'] = [];
    const warnings: BulkValidationResult['warnings'] = [];
    let duplicateRecords = 0;
    let weekendRecords = 0;
    let futureRecords = 0;
    
    const now = new Date();
    const endDate = cohortEndDate || now;
    const seenRecords = new Set<string>();

    records.forEach((record, index) => {
        // Validate student ID
        if (!record.studentId || typeof record.studentId !== 'string') {
            errors.push({
                recordIndex: index,
                field: 'studentId',
                value: record.studentId,
                error: 'Student ID is required and must be a string'
            });
        } else if (validStudentIds && !validStudentIds.has(record.studentId)) {
            errors.push({
                recordIndex: index,
                field: 'studentId',
                value: record.studentId,
                error: 'Student ID does not exist in the cohort'
            });
        }

        // Validate date
        if (!record.date || !(record.date instanceof Date)) {
            errors.push({
                recordIndex: index,
                field: 'date',
                value: record.date,
                error: 'Date is required and must be a valid Date object'
            });
        } else {
            const recordDate = record.date;
            
            // Check if date is within cohort period
            if (recordDate < cohortStartDate) {
                errors.push({
                    recordIndex: index,
                    field: 'date',
                    value: format(recordDate, 'yyyy-MM-dd'),
                    error: 'Date is before cohort start date'
                });
            }
            
            if (recordDate > endDate) {
                errors.push({
                    recordIndex: index,
                    field: 'date',
                    value: format(recordDate, 'yyyy-MM-dd'),
                    error: 'Date is after cohort end date'
                });
            }

            // Check if date is in the future
            if (recordDate > now) {
                futureRecords++;
                errors.push({
                    recordIndex: index,
                    field: 'date',
                    value: format(recordDate, 'yyyy-MM-dd'),
                    error: 'Cannot record attendance for future dates'
                });
            }

            // Check if date is a weekend
            if (isWeekend(recordDate)) {
                weekendRecords++;
                warnings.push({
                    recordIndex: index,
                    field: 'date',
                    value: format(recordDate, 'yyyy-MM-dd'),
                    warning: 'Date is a weekend'
                });
            }

            // Check for duplicates
            const recordKey = `${record.studentId}-${format(recordDate, 'yyyy-MM-dd')}`;
            if (seenRecords.has(recordKey)) {
                duplicateRecords++;
                errors.push({
                    recordIndex: index,
                    field: 'duplicate',
                    value: recordKey,
                    error: 'Duplicate record found for same student and date'
                });
            }
            seenRecords.add(recordKey);

            // Check edit time limit (30 days) - only warning for non-admins
            const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > 30) {
                warnings.push({
                    recordIndex: index,
                    field: 'date',
                    value: format(recordDate, 'yyyy-MM-dd'),
                    warning: 'Date is more than 30 days old - may require admin privileges'
                });
            }
        }

        // Validate attendance status
        if (!record.status || !Object.values(AttendanceStatus).includes(record.status)) {
            errors.push({
                recordIndex: index,
                field: 'status',
                value: record.status,
                error: 'Invalid attendance status'
            });
        }

        // Validate metadata if present
        if (record.metadata) {
            if (record.metadata.notes && typeof record.metadata.notes !== 'string') {
                warnings.push({
                    recordIndex: index,
                    field: 'metadata.notes',
                    value: record.metadata.notes,
                    warning: 'Notes should be a string'
                });
            }
            
            if (record.metadata.reason && typeof record.metadata.reason !== 'string') {
                warnings.push({
                    recordIndex: index,
                    field: 'metadata.reason',
                    value: record.metadata.reason,
                    warning: 'Reason should be a string'
                });
            }
        }
    });

    const validRecords = records.length - errors.length;

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        statistics: {
            totalRecords: records.length,
            validRecords,
            invalidRecords: errors.length,
            duplicateRecords,
            weekendRecords,
            futureRecords
        }
    };
}

/**
 * Prepare bulk attendance records for database operation
 */
export function prepareBulkAttendanceData(
    records: BulkAttendanceRecord[],
    cohortId: string,
    userId: string
): Array<{
    date: Date;
    status: AttendanceStatus;
    studentId: string;
    cohortId: string;
    metadata?: {
        reason?: string;
        notes?: string;
        createdBy: string;
        source: string;
    };
}> {
    return records.map(record => ({
        date: record.date,
        status: record.status,
        studentId: record.studentId,
        cohortId,
        metadata: {
            reason: record.metadata?.reason,
            notes: record.metadata?.notes,
            createdBy: userId,
            source: record.metadata?.source || 'manual'
        }
    }));
}

/**
 * Generate bulk attendance records for a date range with default status
 */
export function generateBulkAttendanceTemplate(
    studentIds: string[],
    startDate: Date,
    endDate: Date,
    defaultStatus: AttendanceStatus = AttendanceStatus.PRESENT,
    excludeWeekends: boolean = true
): BulkAttendanceRecord[] {
    const records: BulkAttendanceRecord[] = [];
    const workingDays = excludeWeekends 
        ? getWorkingDaysBetween(startDate, endDate)
        : [];

    if (!excludeWeekends) {
        // Include all days if weekends are not excluded
        const current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            workingDays.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
    }

    studentIds.forEach(studentId => {
        workingDays.forEach(date => {
            records.push({
                studentId,
                date: new Date(date),
                status: defaultStatus,
                metadata: {
                    source: 'system',
                    notes: 'Generated template record'
                }
            });
        });
    });

    return records;
}

/**
 * Split large bulk operations into smaller batches
 */
export function createAttendanceBatches<T>(
    records: T[],
    batchSize: number = 100
): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize));
    }
    
    return batches;
}

/**
 * Merge bulk operation results
 */
export function mergeBulkOperationResults(results: BulkOperationResult[]): BulkOperationResult {
    if (results.length === 0) {
        return {
            success: true,
            totalRecords: 0,
            processedRecords: 0,
            createdRecords: 0,
            updatedRecords: 0,
            skippedRecords: 0,
            failedRecords: 0,
            errors: [],
            warnings: [],
            summary: {
                duration: 0,
                recordsPerSecond: 0
            }
        };
    }

    const merged: BulkOperationResult = {
        success: results.every(r => r.success),
        totalRecords: results.reduce((sum, r) => sum + r.totalRecords, 0),
        processedRecords: results.reduce((sum, r) => sum + r.processedRecords, 0),
        createdRecords: results.reduce((sum, r) => sum + r.createdRecords, 0),
        updatedRecords: results.reduce((sum, r) => sum + r.updatedRecords, 0),
        skippedRecords: results.reduce((sum, r) => sum + r.skippedRecords, 0),
        failedRecords: results.reduce((sum, r) => sum + r.failedRecords, 0),
        errors: results.flatMap(r => r.errors),
        warnings: results.flatMap(r => r.warnings),
        summary: {
            duration: Math.max(...results.map(r => r.summary.duration)),
            recordsPerSecond: 0 // Will be calculated below
        }
    };

    // Calculate overall records per second
    const totalDuration = merged.summary.duration;
    merged.summary.recordsPerSecond = totalDuration > 0 
        ? merged.processedRecords / (totalDuration / 1000)
        : 0;

    return merged;
}

/**
 * Generate attendance completion report for a cohort
 */
export function generateAttendanceCompletionReport(
    studentIds: string[],
    cohortStartDate: Date,
    cohortEndDate: Date | null,
    existingRecords: Array<{ studentId: string; date: Date }>
): {
    totalWorkingDays: number;
    totalPossibleRecords: number;
    totalExistingRecords: number;
    completionRate: number;
    missingRecordsByStudent: Record<string, {
        studentId: string;
        missingDates: Date[];
        completionRate: number;
    }>;
    overallMissingDates: Date[];
    recommendations: string[];
} {
    const endDate = cohortEndDate || new Date();
    const workingDays = getWorkingDaysBetween(cohortStartDate, endDate);
    const totalWorkingDays = workingDays.length;
    const totalPossibleRecords = totalWorkingDays * studentIds.length;
    
    // Create a set of existing records for quick lookup
    const existingRecordsSet = new Set(
        existingRecords.map(r => `${r.studentId}-${format(r.date, 'yyyy-MM-dd')}`)
    );

    const missingRecordsByStudent: Record<string, {
        studentId: string;
        missingDates: Date[];
        completionRate: number;
    }> = {};

    const overallMissingDates = new Set<string>();

    // Check completion for each student
    studentIds.forEach(studentId => {
        const missingDates: Date[] = [];
        
        workingDays.forEach(date => {
            const recordKey = `${studentId}-${format(date, 'yyyy-MM-dd')}`;
            if (!existingRecordsSet.has(recordKey)) {
                missingDates.push(new Date(date));
                overallMissingDates.add(format(date, 'yyyy-MM-dd'));
            }
        });

        const studentRecordCount = totalWorkingDays - missingDates.length;
        const studentCompletionRate = totalWorkingDays > 0 
            ? (studentRecordCount / totalWorkingDays) * 100 
            : 0;

        missingRecordsByStudent[studentId] = {
            studentId,
            missingDates,
            completionRate: Math.round(studentCompletionRate * 100) / 100
        };
    });

    const totalExistingRecords = existingRecords.length;
    const overallCompletionRate = totalPossibleRecords > 0 
        ? (totalExistingRecords / totalPossibleRecords) * 100 
        : 0;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (overallCompletionRate < 95) {
        recommendations.push('Overall attendance record completion is below 95%. Consider implementing daily attendance recording procedures.');
    }

    const lowCompletionStudents = Object.values(missingRecordsByStudent)
        .filter(s => s.completionRate < 90);
    
    if (lowCompletionStudents.length > 0) {
        recommendations.push(`${lowCompletionStudents.length} students have less than 90% attendance record completion. Focus on catching up these records.`);
    }

    if (overallMissingDates.size > 0) {
        const recentMissingDates = Array.from(overallMissingDates)
            .map(dateStr => parseISO(dateStr))
            .filter(date => {
                const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff <= 7;
            });

        if (recentMissingDates.length > 0) {
            recommendations.push('There are missing attendance records from the past week. Prioritize recording recent attendance data.');
        }
    }

    return {
        totalWorkingDays,
        totalPossibleRecords,
        totalExistingRecords,
        completionRate: Math.round(overallCompletionRate * 100) / 100,
        missingRecordsByStudent,
        overallMissingDates: Array.from(overallMissingDates).map(dateStr => parseISO(dateStr)),
        recommendations
    };
}

/**
 * Create bulk update template for missing attendance records
 */
export function createMissingAttendanceTemplate(
    missingRecordsByStudent: Record<string, {
        studentId: string;
        missingDates: Date[];
        completionRate: number;
    }>,
    defaultStatus: AttendanceStatus = AttendanceStatus.PRESENT
): BulkAttendanceRecord[] {
    const records: BulkAttendanceRecord[] = [];

    Object.values(missingRecordsByStudent).forEach(studentData => {
        studentData.missingDates.forEach(date => {
            records.push({
                studentId: studentData.studentId,
                date: new Date(date),
                status: defaultStatus,
                metadata: {
                    source: 'system',
                    notes: 'Auto-generated for missing attendance record',
                    reason: 'Backfill missing data'
                }
            });
        });
    });

    // Sort by date and then by student ID for consistent processing
    return records.sort((a, b) => {
        const dateCompare = a.date.getTime() - b.date.getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.studentId.localeCompare(b.studentId);
    });
}

/**
 * Estimate bulk operation performance
 */
export function estimateBulkOperationPerformance(
    recordCount: number,
    batchSize: number = 100,
    estimatedRecordsPerSecond: number = 50
): {
    estimatedDuration: number; // in seconds
    recommendedBatchSize: number;
    totalBatches: number;
    estimatedMemoryUsage: number; // in MB
} {
    const estimatedDuration = recordCount / estimatedRecordsPerSecond;
    
    // Adjust batch size based on record count
    let recommendedBatchSize = batchSize;
    if (recordCount > 10000) {
        recommendedBatchSize = 200;
    } else if (recordCount > 1000) {
        recommendedBatchSize = 100;
    } else {
        recommendedBatchSize = 50;
    }

    // Rough estimate: each record ~1KB in memory
    const estimatedMemoryUsage = (recordCount * 1) / 1024; // Convert to MB

    return {
        estimatedDuration: Math.round(estimatedDuration * 100) / 100,
        recommendedBatchSize,
        totalBatches: Math.ceil(recordCount / recommendedBatchSize),
        estimatedMemoryUsage: Math.round(estimatedMemoryUsage * 100) / 100
    };
}
