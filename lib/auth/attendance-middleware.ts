import { type AttendancePermission } from './attendance-permissions';
import { getAttendanceAuthContext, verifyAttendanceViewAccess, verifyAttendanceEditAccess, logAttendanceOperation } from './attendance-auth';
import type { ServerActionResult } from '@/lib/server-action-utils';

/**
 * Higher-order function to wrap server actions with attendance authorization
 */
export function withAttendanceAuth<T extends any[], R>(
    requiredPermission: AttendancePermission,
    serverAction: (...args: T) => Promise<ServerActionResult<R>>,
    options?: {
        requireCohortAccess?: boolean;
        allowEditTimeLimit?: boolean;
        logOperation?: {
            operation: 'view' | 'create' | 'update' | 'delete' | 'export';
            resource: string;
            getResourceId?: (...args: T) => string;
        };
    }
) {
    return async (...args: T): Promise<ServerActionResult<R>> => {
        try {
            // Get authentication context
            const authContext = await getAttendanceAuthContext();
            
            if (!authContext) {
                return {
                    success: false,
                    error: 'Authentication required'
                };
            }

            // Check if user has required permission
            if (!authContext.permissions.includes(requiredPermission)) {
                return {
                    success: false,
                    error: 'Insufficient permissions'
                };
            }

            // If cohort access is required, verify it
            if (options?.requireCohortAccess) {
                const cohortId = extractCohortId(args);
                if (cohortId && !authContext.cohortIds.includes(cohortId)) {
                    return {
                        success: false,
                        error: 'Access denied for this cohort'
                    };
                }
            }

            // If edit time limit is enforced, check it
            if (options?.allowEditTimeLimit) {
                const { cohortId, date } = extractEditParams(args);
                if (cohortId && date) {
                    const editAccess = await verifyAttendanceEditAccess(cohortId, date);
                    if (!editAccess.success) {
                        return {
                            success: false,
                            error: editAccess.error || 'Edit access denied'
                        };
                    }
                }
            }

            // Log the operation if requested
            if (options?.logOperation) {
                const resourceId = options.logOperation.getResourceId 
                    ? options.logOperation.getResourceId(...args)
                    : 'unknown';
                    
                await logAttendanceOperation(
                    options.logOperation.operation,
                    options.logOperation.resource,
                    resourceId,
                    { args: JSON.stringify(args) }
                );
            }

            // Execute the actual server action
            return await serverAction(...args);

        } catch (error) {
            return {
                success: false,
                error: 'An error occurred while processing the request'
            };
        }
    };
}

/**
 * Wrapper specifically for attendance view operations
 */
export function withAttendanceViewAuth<T extends any[], R>(
    serverAction: (...args: T) => Promise<ServerActionResult<R>>,
    options?: {
        logResource?: string;
        extractCohortId?: (...args: T) => string | undefined;
    }
) {
    return async (...args: T): Promise<ServerActionResult<R>> => {
        // Verify view access
        const cohortId = options?.extractCohortId ? options.extractCohortId(...args) : undefined;
        const accessCheck = await verifyAttendanceViewAccess(cohortId);
        
        if (!accessCheck.success) {
            return {
                success: false,
                error: accessCheck.error || 'Access denied'
            };
        }

        // Log the view operation
        if (options?.logResource && accessCheck.authContext) {
            await logAttendanceOperation(
                'view',
                options.logResource,
                cohortId || 'all',
                { userId: accessCheck.authContext.userId }
            );
        }

        // Execute the server action
        return await serverAction(...args);
    };
}

/**
 * Wrapper specifically for attendance edit operations
 */
export function withAttendanceEditAuth<T extends any[], R>(
    serverAction: (...args: T) => Promise<ServerActionResult<R>>,
    options: {
        extractCohortId: (...args: T) => string;
        extractDate: (...args: T) => Date | string;
        logResource?: string;
        getResourceId?: (...args: T) => string;
    }
) {
    return async (...args: T): Promise<ServerActionResult<R>> => {
        const cohortId = options.extractCohortId(...args);
        const date = options.extractDate(...args);
        
        // Verify edit access
        const editAccess = await verifyAttendanceEditAccess(cohortId, date);
        
        if (!editAccess.success) {
            return {
                success: false,
                error: editAccess.error || 'Edit access denied'
            };
        }

        // Log the edit operation
        if (options?.logResource && editAccess.authContext) {
            const dateForLogging = typeof date === 'string' ? new Date(date) : date;
            /*
            // Normalize date for logging
            const normalizedDate = typeof date === 'string' 
                ? (() => {
                    const [year, month, day] = date.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  })()
                : date;
            */ 

            const resourceId = options.getResourceId 
                ? options.getResourceId(...args)
                : `${cohortId}-${dateForLogging.toISOString().split('T')[0]}`;
                
            await logAttendanceOperation(
                'update',
                options.logResource,
                resourceId,
                { 
                    userId: editAccess.authContext.userId,
                    cohortId,
                    date: dateForLogging.toISOString()
                }
            );
        }

        // Execute the server action
        return await serverAction(...args);
    };
}

// Helper functions to extract parameters from arguments
function extractCohortId(args: any[]): string | undefined {
    // Try to find cohortId in common parameter patterns
    if (args.length > 0) {
        const firstArg = args[0];
        if (typeof firstArg === 'string') {
            return firstArg; // Assume first string arg is cohortId
        }
        if (typeof firstArg === 'object' && firstArg?.cohortId) {
            return firstArg.cohortId;
        }
    }
    return undefined;
}

function extractEditParams(args: any[]): { cohortId?: string; date?: Date } {
    let cohortId: string | undefined;
    let date: Date | undefined;

    for (const arg of args) {
        if (typeof arg === 'object' && arg) {
            if (arg.cohortId && typeof arg.cohortId === 'string') {
                cohortId = arg.cohortId;
            }
            if (arg.date && arg.date instanceof Date) {
                date = arg.date;
            }
        }
    }

    return { cohortId, date };
}

/**
 * Rate limiting for attendance operations
 */
const operationLimits = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit<T extends any[], R>(
    serverAction: (...args: T) => Promise<ServerActionResult<R>>,
    options: {
        maxRequests: number;
        windowMs: number;
        keyExtractor?: (...args: T) => string;
    }
) {
    return async (...args: T): Promise<ServerActionResult<R>> => {
        const authContext = await getAttendanceAuthContext();
        
        if (!authContext) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }

        // Generate rate limit key
        const key = options.keyExtractor 
            ? options.keyExtractor(...args)
            : authContext.userId;

        const now = Date.now();
        const limit = operationLimits.get(key);

        if (limit) {
            if (now < limit.resetTime) {
                if (limit.count >= options.maxRequests) {
                    return {
                        success: false,
                        error: 'Rate limit exceeded. Please try again later.'
                    };
                }
                limit.count++;
            } else {
                // Reset the limit
                operationLimits.set(key, { count: 1, resetTime: now + options.windowMs });
            }
        } else {
            operationLimits.set(key, { count: 1, resetTime: now + options.windowMs });
        }

        return await serverAction(...args);
    };
}
