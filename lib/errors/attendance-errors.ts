/**
 * Custom error classes and error handling utilities for attendance system
 */

export class AttendanceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AttendanceError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AttendanceError);
    }
  }
}

export class AttendanceValidationError extends AttendanceError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; code?: string }>,
    context?: Record<string, any>
  ) {
    super(message, 'ATTENDANCE_VALIDATION_ERROR', 400, context);
    this.name = 'AttendanceValidationError';
    this.validationErrors = validationErrors;
  }
}

export class AttendancePermissionError extends AttendanceError {
  constructor(
    message: string,
    userId?: string,
    requiredRole?: string,
    context?: Record<string, any>
  ) {
    super(message, 'ATTENDANCE_PERMISSION_ERROR', 403, {
      ...context,
      userId,
      requiredRole
    });
    this.name = 'AttendancePermissionError';
  }
}

export class AttendanceNotFoundError extends AttendanceError {
  constructor(
    resource: string,
    id: string,
    context?: Record<string, any>
  ) {
    super(`${resource} not found`, 'ATTENDANCE_NOT_FOUND', 404, {
      ...context,
      resource,
      id
    });
    this.name = 'AttendanceNotFoundError';
  }
}

export class AttendanceBusinessRuleError extends AttendanceError {
  public readonly ruleType: string;

  constructor(
    message: string,
    ruleType: string,
    context?: Record<string, any>
  ) {
    super(message, 'ATTENDANCE_BUSINESS_RULE_ERROR', 422, context);
    this.name = 'AttendanceBusinessRuleError';
    this.ruleType = ruleType;
  }
}

export class AttendanceConflictError extends AttendanceError {
  constructor(
    message: string,
    conflictingResource?: string,
    context?: Record<string, any>
  ) {
    super(message, 'ATTENDANCE_CONFLICT_ERROR', 409, {
      ...context,
      conflictingResource
    });
    this.name = 'AttendanceConflictError';
  }
}

export class AttendanceRateLimitError extends AttendanceError {
  public readonly retryAfter: number;

  constructor(
    message: string,
    retryAfter: number = 60,
    context?: Record<string, any>
  ) {
    super(message, 'ATTENDANCE_RATE_LIMIT_ERROR', 429, context);
    this.name = 'AttendanceRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error response format for API responses
 */
export interface AttendanceErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    context?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
  warnings?: string[];
}

/**
 * Create standardized error response
 */
export function createAttendanceErrorResponse(
  error: AttendanceError | Error,
  requestId?: string,
  warnings?: string[]
): AttendanceErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof AttendanceError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error instanceof AttendanceValidationError ? error.validationErrors : undefined,
        context: error.context,
        timestamp,
        requestId
      },
      ...(warnings && warnings.length > 0 && { warnings })
    };
  }

  // Generic error
  return {
    success: false,
    error: {
      code: 'ATTENDANCE_INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp,
      requestId
    },
    ...(warnings && warnings.length > 0 && { warnings })
  };
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Get error severity based on error type
 */
export function getErrorSeverity(error: AttendanceError | Error): ErrorSeverity {
  if (error instanceof AttendancePermissionError) {
    return ErrorSeverity.HIGH;
  }

  if (error instanceof AttendanceBusinessRuleError) {
    return ErrorSeverity.MEDIUM;
  }

  if (error instanceof AttendanceValidationError) {
    return ErrorSeverity.LOW;
  }

  if (error instanceof AttendanceConflictError) {
    return ErrorSeverity.MEDIUM;
  }

  if (error instanceof AttendanceRateLimitError) {
    return ErrorSeverity.LOW;
  }

  if (error instanceof AttendanceNotFoundError) {
    return ErrorSeverity.LOW;
  }

  // Generic errors are treated as high severity
  return ErrorSeverity.HIGH;
}

/**
 * Error recovery suggestions
 */
export function getErrorRecoverySuggestion(error: AttendanceError): string | null {
  switch (error.code) {
    case 'ATTENDANCE_VALIDATION_ERROR':
      return 'Please check your input data and try again';
    
    case 'ATTENDANCE_PERMISSION_ERROR':
      return 'Contact your administrator to request the necessary permissions';
    
    case 'ATTENDANCE_NOT_FOUND':
      return 'Verify the resource exists and try again';
    
    case 'ATTENDANCE_BUSINESS_RULE_ERROR':
      return 'Review the attendance policies and adjust your request';
    
    case 'ATTENDANCE_CONFLICT_ERROR':
      return 'Refresh your data and try again, or contact support if the issue persists';
    
    case 'ATTENDANCE_RATE_LIMIT_ERROR':
      return 'Wait a moment before trying again';
    
    default:
      return 'Contact support if this issue persists';
  }
}

/**
 * Utility to determine if an error should be retried
 */
export function isRetriableError(error: AttendanceError | Error): boolean {
  if (error instanceof AttendanceRateLimitError) {
    return true;
  }

  if (error instanceof AttendanceConflictError) {
    return true;
  }

  // Network or temporary errors (detected by message content)
  const message = error.message.toLowerCase();
  const retriableKeywords = [
    'timeout',
    'network',
    'connection',
    'temporary',
    'unavailable',
    'busy'
  ];

  return retriableKeywords.some(keyword => message.includes(keyword));
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(
  error: AttendanceError | Error,
  context?: Record<string, any>
): Record<string, any> {
  const baseLog = {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    timestamp: new Date().toISOString(),
    ...context
  };

  if (error instanceof AttendanceError) {
    return {
      ...baseLog,
      errorCode: error.code,
      statusCode: error.statusCode,
      errorContext: error.context,
      severity: getErrorSeverity(error),
      isRetriable: isRetriableError(error),
      recoverySuggestion: getErrorRecoverySuggestion(error)
    };
  }

  return {
    ...baseLog,
    severity: ErrorSeverity.HIGH,
    isRetriable: isRetriableError(error)
  };
}

/**
 * Error aggregation for bulk operations
 */
export class AttendanceBulkError extends AttendanceError {
  public readonly individualErrors: Array<{
    index: number;
    error: AttendanceError;
    data?: any;
  }>;
  public readonly successCount: number;
  public readonly failureCount: number;

  constructor(
    message: string,
    individualErrors: Array<{ index: number; error: AttendanceError; data?: any }>,
    successCount: number
  ) {
    super(message, 'ATTENDANCE_BULK_ERROR', 207); // 207 Multi-Status
    this.name = 'AttendanceBulkError';
    this.individualErrors = individualErrors;
    this.successCount = successCount;
    this.failureCount = individualErrors.length;
  }

  public getSummary(): {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    errorBreakdown: Record<string, number>;
  } {
    const totalProcessed = this.successCount + this.failureCount;
    const successRate = totalProcessed > 0 ? (this.successCount / totalProcessed) * 100 : 0;
    
    const errorBreakdown: Record<string, number> = {};
    this.individualErrors.forEach(({ error }) => {
      const code = error.code;
      errorBreakdown[code] = (errorBreakdown[code] || 0) + 1;
    });

    return {
      totalProcessed,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate,
      errorBreakdown
    };
  }
}

/**
 * Helper to wrap async operations with error handling
 */
export async function withAttendanceErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AttendanceError) {
      // Re-throw attendance errors as-is
      throw error;
    }

    // Wrap generic errors
    throw new AttendanceError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      'ATTENDANCE_INTERNAL_ERROR',
      500,
      {
        ...context,
        originalError: error instanceof Error ? error.name : typeof error
      }
    );
  }
}

/**
 * Validation helpers for common error scenarios
 */
export function validateRequiredField(value: any, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new AttendanceValidationError(
      'Validation failed',
      [{ field: fieldName, message: `${fieldName} is required` }]
    );
  }
}

export function validateDateRange(startDate: Date, endDate: Date): void {
  if (startDate > endDate) {
    throw new AttendanceValidationError(
      'Invalid date range',
      [{ field: 'dateRange', message: 'Start date must be before or equal to end date' }]
    );
  }
}

export function validateUserPermission(
  userRole: string,
  requiredRoles: string[],
  userId?: string
): void {
  if (!requiredRoles.includes(userRole)) {
    throw new AttendancePermissionError(
      `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      userId,
      requiredRoles.join(', ')
    );
  }
}

/**
 * All error types are already exported above
 * Additional exports can be added here if needed
 */
