'use server';

import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { UserRole, UserStatus } from '@prisma/client';
import { 
    ATTENDANCE_PERMISSIONS, 
    ROLE_PERMISSIONS,
    type AttendancePermission, 
    type AttendanceAuthContext 
} from './attendance-permissions';

/**
 * Get the current authentication context for attendance operations
 */
export async function getAttendanceAuthContext(): Promise<AttendanceAuthContext | null> {
    try {
        const session = await auth();
        
        if (!session?.user?.id || !session?.user?.role) {
            return null;
        }

        // Get user details with cohort information
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                role: true,
                status: true,
                cohortId: true,
                cohort: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!user || user.status !== UserStatus.ACTIVE) {
            return null;
        }

        // Determine accessible cohort IDs based on role
        let cohortIds: string[] = [];
        
        if (user.role === UserRole.ADMIN || user.role === UserRole.MENTOR) {
            // Admins and mentors can access all cohorts
            const allCohorts = await prisma.cohort.findMany({
                select: { id: true }
            });
            cohortIds = allCohorts.map(c => c.id);
        } else if (user.role === UserRole.STUDENT && user.cohortId) {
            // Students can only access their own cohort
            cohortIds = [user.cohortId];
        }

        return {
            userId: user.id,
            userRole: user.role,
            userStatus: user.status,
            permissions: ROLE_PERMISSIONS[user.role] || [],
            cohortIds
        };

    } catch (error) {
        logger.error('Failed to get attendance auth context', error instanceof Error ? error : new Error(String(error)), {
            metadata: { 
                action: 'get_auth_context',
                resource: 'attendance_auth'
            }
        });
        return null;
    }
}

/**
 * Check if the current user has a specific attendance permission
 */
export async function hasAttendancePermission(permission: AttendancePermission): Promise<boolean> {
    const authContext = await getAttendanceAuthContext();
    
    if (!authContext) {
        return false;
    }

    return authContext.permissions.includes(permission);
}

/**
 * Check if the current user can access a specific cohort
 */
export async function canAccessCohort(cohortId: string): Promise<boolean> {
    const authContext = await getAttendanceAuthContext();
    
    if (!authContext) {
        return false;
    }

    return authContext.cohortIds.includes(cohortId);
}

/**
 * Verify that the current user can view attendance data
 */
export async function verifyAttendanceViewAccess(cohortId?: string): Promise<{
    success: boolean;
    error?: string;
    authContext?: AttendanceAuthContext;
}> {
    const authContext = await getAttendanceAuthContext();
    
    if (!authContext) {
        logger.warn('Unauthorized attendance access attempt', {
            action: 'verify_access',
            resource: 'attendance_view',
            metadata: { cohortId }
        });
        
        return {
            success: false,
            error: 'Authentication required'
        };
    }

    // Check view permission
    if (!authContext.permissions.includes(ATTENDANCE_PERMISSIONS.VIEW_ATTENDANCE)) {
        logger.warn('Access denied for attendance viewing', {
            action: 'verify_access',
            resource: 'attendance_view',
            metadata: { 
                userId: authContext.userId,
                userRole: authContext.userRole,
                cohortId
            }
        });
        
        return {
            success: false,
            error: 'Insufficient permissions to view attendance data'
        };
    }

    // Check cohort-specific access if cohort ID is provided
    if (cohortId && !authContext.cohortIds.includes(cohortId)) {
        logger.warn('Access denied for specific cohort', {
            action: 'verify_access',
            resource: 'attendance_view',
            metadata: { 
                userId: authContext.userId,
                userRole: authContext.userRole,
                cohortId,
                accessibleCohorts: authContext.cohortIds.length
            }
        });
        
        return {
            success: false,
            error: 'Access denied for this cohort'
        };
    }

    logger.info('Attendance access granted', {
        action: 'verify_access',
        resource: 'attendance_view',
        metadata: { 
            userId: authContext.userId,
            userRole: authContext.userRole,
            cohortId,
            permissions: authContext.permissions.length
        }
    });

    return {
        success: true,
        authContext
    };
}

/**
 * Verify that the current user can edit attendance data
 */
export async function verifyAttendanceEditAccess(cohortId: string, targetDate: Date | string): Promise<{
    success: boolean;
    error?: string;
    authContext?: AttendanceAuthContext;
    isEditable?: boolean;
}> {
    const dateToCheck = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    /* 
    // Normalize targetDate to Date object for consistent handling
    const normalizedDate = typeof targetDate === 'string' 
        ? (() => {
            const [year, month, day] = targetDate.split('-').map(Number);
            return new Date(year, month - 1, day);
          })()
        : targetDate;
    */

    const authContext = await getAttendanceAuthContext();
    
    if (!authContext) {
        return {
            success: false,
            error: 'Authentication required'
        };
    }

    // Check edit permission
    if (!authContext.permissions.includes(ATTENDANCE_PERMISSIONS.EDIT_ATTENDANCE)) {
        logger.warn('Access denied for attendance editing', {
            action: 'verify_edit_access',
            resource: 'attendance_edit',
            metadata: { 
                userId: authContext.userId,
                userRole: authContext.userRole,
                cohortId,
                date: dateToCheck.toISOString()
            }
        });
        
        return {
            success: false,
            error: 'Insufficient permissions to edit attendance data'
        };
    }

    // Check cohort access
    if (!authContext.cohortIds.includes(cohortId)) {
        return {
            success: false,
            error: 'Access denied for this cohort'
        };
    }

    // Check if the date is within the editable window (30 days)
    const daysDifference = Math.floor((Date.now() - dateToCheck.getTime()) / (1000 * 60 * 60 * 24));
    const isEditable = daysDifference <= 30;

    if (!isEditable && authContext.userRole !== UserRole.ADMIN) {
        logger.warn('Edit attempt beyond allowed timeframe', {
            action: 'verify_edit_access',
            resource: 'attendance_edit',
            metadata: { 
                userId: authContext.userId,
                userRole: authContext.userRole,
                cohortId,
                date: dateToCheck.toISOString(),
                daysPast: daysDifference
            }
        });
        
        return {
            success: false,
            error: 'Cannot edit attendance data older than 30 days'
        };
    }

    return {
        success: true,
        authContext,
        isEditable
    };
}

/**
 * Log an attendance operation for audit purposes
 */
export async function logAttendanceOperation(
    operation: 'view' | 'create' | 'update' | 'delete' | 'export',
    resource: string,
    resourceId: string,
    metadata?: Record<string, any>
): Promise<void> {
    const authContext = await getAttendanceAuthContext();
    
    if (!authContext) {
        return;
    }

    logger.info(`Attendance operation: ${operation}`, {
        action: operation,
        resource: `attendance_${resource}`,
        metadata: {
            userId: authContext.userId,
            userRole: authContext.userRole,
            resourceId,
            timestamp: new Date().toISOString(),
            ...metadata
        }
    });
}
