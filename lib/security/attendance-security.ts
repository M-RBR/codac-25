'use server';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAttendanceAuthContext } from '@/lib/auth/attendance-auth';
import { UserRole } from '@prisma/client';

/**
 * Security validation utilities for attendance operations
 */

// Input sanitization for attendance data
export function sanitizeAttendanceInput(input: any): any {
    if (typeof input !== 'object' || input === null) {
        return null;
    }

    const sanitized: any = {};

    // Sanitize string fields
    if (input.cohortId && typeof input.cohortId === 'string') {
        sanitized.cohortId = input.cohortId.trim().slice(0, 100); // Limit length
    }

    // Sanitize date fields
    if (input.date) {
        if (input.date instanceof Date) {
            sanitized.date = input.date;
        } else if (typeof input.date === 'string') {
            const parsedDate = new Date(input.date);
            if (!isNaN(parsedDate.getTime())) {
                sanitized.date = parsedDate;
            }
        }
    }

    // Sanitize attendance records array
    if (Array.isArray(input.attendanceRecords)) {
        sanitized.attendanceRecords = input.attendanceRecords
            .slice(0, 100) // Limit array size
            .map((record: any) => {
                if (typeof record !== 'object' || record === null) {
                    return null;
                }
                
                const sanitizedRecord: any = {};
                
                if (record.studentId && typeof record.studentId === 'string') {
                    sanitizedRecord.studentId = record.studentId.trim().slice(0, 100);
                }
                
                if (record.status && typeof record.status === 'string') {
                    // Validate against known status values
                    const validStatuses = ['PRESENT', 'ABSENT_SICK', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED'];
                    if (validStatuses.includes(record.status)) {
                        sanitizedRecord.status = record.status;
                    }
                }
                
                return sanitizedRecord.studentId && sanitizedRecord.status ? sanitizedRecord : null;
            })
            .filter(Boolean);
    }

    return sanitized;
}

// Business logic validation
export async function validateAttendanceOperation(
    operation: 'view' | 'create' | 'update' | 'delete',
    data: any
): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
        const authContext = await getAttendanceAuthContext();
        
        if (!authContext) {
            errors.push('Authentication required');
            return { valid: false, errors };
        }

        // Common validations for all operations
        if (data.cohortId) {
            // Verify cohort exists and user has access
            const cohort = await prisma.cohort.findUnique({
                where: { id: data.cohortId },
                select: { id: true, name: true, startDate: true, endDate: true }
            });

            if (!cohort) {
                errors.push('Cohort not found');
            } else if (!authContext.cohortIds.includes(data.cohortId)) {
                errors.push('Access denied for this cohort');
            }

            // Date range validation
            if (data.date && cohort) {
                const targetDate = new Date(data.date);
                const cohortStart = new Date(cohort.startDate);
                const cohortEnd = cohort.endDate ? new Date(cohort.endDate) : new Date();

                if (targetDate < cohortStart || targetDate > cohortEnd) {
                    errors.push('Date is outside cohort duration');
                }

                // Weekend validation
                const dayOfWeek = targetDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    errors.push('Cannot record attendance for weekends');
                }

                // Future date validation
                if (targetDate > new Date()) {
                    errors.push('Cannot record attendance for future dates');
                }
            }
        }

        // Operation-specific validations
        switch (operation) {
            case 'create':
            case 'update':
                // Check edit time limits for non-admins
                if (data.date && authContext.userRole !== UserRole.ADMIN) {
                    const daysDiff = Math.floor((Date.now() - new Date(data.date).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysDiff > 30) {
                        errors.push('Cannot modify attendance data older than 30 days');
                    }
                }

                // Validate student IDs if provided
                if (data.attendanceRecords && Array.isArray(data.attendanceRecords)) {
                    const studentIds = data.attendanceRecords.map((r: any) => r.studentId).filter(Boolean);
                    
                    if (studentIds.length > 0) {
                        const validStudents = await prisma.user.findMany({
                            where: {
                                id: { in: studentIds },
                                cohortId: data.cohortId,
                                role: UserRole.STUDENT,
                                status: 'ACTIVE'
                            },
                            select: { id: true }
                        });

                        const validStudentIds = new Set(validStudents.map(s => s.id));
                        const invalidStudentIds = studentIds.filter((id: string) => !validStudentIds.has(id));
                        
                        if (invalidStudentIds.length > 0) {
                            errors.push(`Invalid student IDs: ${invalidStudentIds.join(', ')}`);
                        }
                    }
                }
                break;

            case 'delete':
                // Only admins can delete attendance records
                if (authContext.userRole !== UserRole.ADMIN) {
                    errors.push('Only administrators can delete attendance records');
                }
                break;
        }

    } catch (error) {
        logger.error('Attendance validation error', error instanceof Error ? error : new Error(String(error)), {
            metadata: { operation, data: JSON.stringify(data) }
        });
        errors.push('Validation error occurred');
    }

    return { valid: errors.length === 0, errors };
}

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStorage = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(
    userId: string,
    operation: string,
    maxRequests: number = 100,
    windowMs: number = 60000 // 1 minute
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `${userId}:${operation}`;
    const now = Date.now();
    
    let bucket = rateLimitStorage.get(key);
    
    if (!bucket || now > bucket.resetTime) {
        bucket = { count: 0, resetTime: now + windowMs };
        rateLimitStorage.set(key, bucket);
    }
    
    if (bucket.count >= maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: bucket.resetTime
        };
    }
    
    bucket.count++;
    
    return {
        allowed: true,
        remaining: maxRequests - bucket.count,
        resetTime: bucket.resetTime
    };
}

// Security event logging
export async function logSecurityEvent(
    eventType: 'unauthorized_access' | 'suspicious_activity' | 'rate_limit_exceeded' | 'validation_failed',
    details: Record<string, any>
): Promise<void> {
    const authContext = await getAttendanceAuthContext();
    
    logger.warn(`Security event: ${eventType}`, {
        action: 'security_event',
        resource: 'attendance',
        metadata: {
            eventType,
            userId: authContext?.userId || 'unknown',
            userRole: authContext?.userRole || 'unknown',
            timestamp: new Date().toISOString(),
            ...details
        }
    });
    
    // In production, consider sending alerts for critical security events
    if (eventType === 'unauthorized_access' || eventType === 'suspicious_activity') {
        // Could integrate with external monitoring service here
        console.warn(`🚨 Critical security event: ${eventType}`, details);
    }
}

// Data integrity checks
export async function validateDataIntegrity(cohortId: string, date: Date): Promise<{
    valid: boolean;
    issues: string[];
}> {
    const issues: string[] = [];
    
    try {
        // Check for duplicate attendance records
        const duplicates = await prisma.attendance.groupBy({
            by: ['studentId', 'date'],
            where: {
                cohortId,
                date
            },
            _count: {
                id: true
            },
            having: {
                id: { _count: { gt: 1 } }
            }
        });

        if (duplicates.length > 0) {
            issues.push(`Found ${duplicates.length} duplicate attendance records`);
        }

        // Check for attendance records for non-existent students
        const attendanceRecords = await prisma.attendance.findMany({
            where: { cohortId, date },
            select: { studentId: true }
        });

        if (attendanceRecords.length > 0) {
            const studentIds = attendanceRecords.map(r => r.studentId);
            const existingStudents = await prisma.user.findMany({
                where: {
                    id: { in: studentIds },
                    cohortId,
                    role: UserRole.STUDENT
                },
                select: { id: true }
            });

            const existingStudentIds = new Set(existingStudents.map(s => s.id));
            const orphanedRecords = studentIds.filter(id => !existingStudentIds.has(id));
            
            if (orphanedRecords.length > 0) {
                issues.push(`Found ${orphanedRecords.length} attendance records for non-existent students`);
            }
        }

    } catch (error) {
        logger.error('Data integrity validation error', error instanceof Error ? error : new Error(String(error)), {
            metadata: { cohortId, date: date.toISOString() }
        });
        issues.push('Failed to validate data integrity');
    }

    return {
        valid: issues.length === 0,
        issues
    };
}
