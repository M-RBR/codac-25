/**
 * Security validation and sanitization utilities for attendance system
 */

import { z } from 'zod';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { 
  AttendanceValidationError, 
  AttendancePermissionError,
  AttendanceBusinessRuleError 
} from '@/lib/errors/attendance-errors';

/**
 * Input sanitization functions
 */

export function sanitizeString(input: string, maxLength: number = 255): string {
  if (typeof input !== 'string') {
    throw new AttendanceValidationError(
      'Invalid input type',
      [{ field: 'input', message: 'Expected string input' }]
    );
  }

  return input
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, maxLength);
}

export function sanitizeNotes(notes: string): string {
  if (!notes) return '';
  
  return notes
    .trim()
    .replace(/[<>'"&]/g, '') // Remove HTML/script injection risks
    .replace(/\r?\n/g, ' ') // Convert newlines to spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 500); // Limit length
}

export function sanitizeEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = sanitizeString(email.toLowerCase(), 254);
  
  if (!emailRegex.test(sanitized)) {
    throw new AttendanceValidationError(
      'Invalid email format',
      [{ field: 'email', message: 'Please provide a valid email address' }]
    );
  }
  
  return sanitized;
}

/**
 * SQL injection prevention
 */
export function validateSQLSafeString(input: string): boolean {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|\/\*|\*\/)/,
    /['"`;\\]/,
    /\b(OR|AND)\s+\d+\s*=\s*\d+/i
  ];

  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * XSS prevention
 */
export function sanitizeForXSS(input: string): string {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<[^>]+>/g // Remove all HTML tags
  ];

  let sanitized = input;
  xssPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
}

/**
 * Data validation schemas with security constraints
 */

const secureStringSchema = z.string()
  .min(1, 'Value is required')
  .max(255, 'Value too long')
  .refine(validateSQLSafeString, 'Invalid characters detected');

const secureIdSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID contains invalid characters')
  .min(1, 'ID is required')
  .max(50, 'ID too long');

const secureDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD required)')
  .refine(dateStr => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2030;
  }, 'Date must be between 2020 and 2030');

export const secureAttendanceRecordSchema = z.object({
  studentId: secureIdSchema,
  cohortId: secureIdSchema,
  date: secureDateSchema,
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string()
    .max(500, 'Notes too long')
    .optional()
    .transform(notes => notes ? sanitizeNotes(notes) : undefined),
  recordedBy: secureIdSchema
});

/**
 * Security context validation
 */
export interface SecurityContext {
  userId: string;
  userRole: UserRole;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  requestId: string;
}

export function validateSecurityContext(context: Partial<SecurityContext>): SecurityContext {
  if (!context.userId || !validateSQLSafeString(context.userId)) {
    throw new AttendancePermissionError('Invalid user ID');
  }

  if (!context.userRole || !Object.values(UserRole).includes(context.userRole)) {
    throw new AttendancePermissionError('Invalid user role');
  }

  if (!context.requestId) {
    throw new AttendanceValidationError(
      'Missing security context',
      [{ field: 'requestId', message: 'Request ID is required' }]
    );
  }

  return {
    userId: context.userId,
    userRole: context.userRole,
    userAgent: context.userAgent?.substring(0, 500),
    ipAddress: context.ipAddress?.substring(0, 45), // IPv6 max length
    sessionId: context.sessionId?.substring(0, 128),
    requestId: context.requestId
  };
}

/**
 * Rate limiting and abuse prevention
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; resetTime?: number; remaining?: number } {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      resetTime,
      remaining: config.maxRequests - 1
    };
  }

  if (current.count >= config.maxRequests) {
    return {
      allowed: false,
      resetTime: current.resetTime,
      remaining: 0
    };
  }

  current.count++;
  return {
    allowed: true,
    resetTime: current.resetTime,
    remaining: config.maxRequests - current.count
  };
}

/**
 * Attendance-specific security rules
 */
export function validateAttendanceBusinessSecurity(
  operation: string,
  data: any,
  context: SecurityContext
): void {
  // Rule 1: Users can only modify attendance for their authorized cohorts
  if (['create', 'update', 'delete'].includes(operation)) {
    if (!data.cohortId || !validateSQLSafeString(data.cohortId)) {
      throw new AttendanceBusinessRuleError(
        'Invalid cohort ID',
        'INVALID_COHORT_ID'
      );
    }
  }

  // Rule 2: Bulk operations are limited by role
  if (operation === 'bulk_update') {
    if (context.userRole !== UserRole.ADMIN && data.records?.length > 50) {
      throw new AttendanceBusinessRuleError(
        'Bulk operation size exceeds limit for your role',
        'BULK_SIZE_LIMIT_EXCEEDED'
      );
    }
  }

  // Rule 3: Historical data modification restrictions
  if (['update', 'delete'].includes(operation) && data.date) {
    const recordDate = new Date(data.date);
    const daysDiff = Math.floor((Date.now() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 30 && context.userRole !== UserRole.ADMIN) {
      throw new AttendanceBusinessRuleError(
        'Cannot modify attendance records older than 30 days',
        'HISTORICAL_MODIFICATION_RESTRICTED'
      );
    }
  }

  // Rule 4: Weekend attendance restrictions
  if (['create', 'update'].includes(operation) && data.date) {
    const date = new Date(data.date);
    const dayOfWeek = date.getDay();
    
    if ((dayOfWeek === 0 || dayOfWeek === 6) && context.userRole !== UserRole.ADMIN) {
      throw new AttendanceBusinessRuleError(
        'Weekend attendance can only be modified by administrators',
        'WEEKEND_MODIFICATION_RESTRICTED'
      );
    }
  }

  // Rule 5: Export data size limits
  if (operation === 'export') {
    const dateRange = data.dateRange;
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 365 && context.userRole !== UserRole.ADMIN) {
        throw new AttendanceBusinessRuleError(
          'Export date range cannot exceed 365 days for non-admin users',
          'EXPORT_RANGE_LIMIT_EXCEEDED'
        );
      }
    }
  }
}

/**
 * Cryptographic utilities for sensitive data
 */
export function hashSensitiveData(data: string): string {
  // Simple hash for demonstration - in production, use proper crypto library
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Audit trail helpers
 */
export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  userRole: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

export function createAuditLogEntry(
  action: string,
  resourceType: string,
  resourceId: string,
  context: SecurityContext,
  changes?: Record<string, { from: any; to: any }>,
  metadata?: Record<string, any>
): AuditLogEntry {
  return {
    action,
    resourceType,
    resourceId,
    userId: context.userId,
    userRole: context.userRole,
    timestamp: new Date(),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    changes,
    metadata: {
      ...metadata,
      requestId: context.requestId,
      sessionId: context.sessionId
    }
  };
}

/**
 * Data masking for logs and exports
 */
export function maskSensitiveData(data: any, fieldsToMask: string[] = []): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'email',
    'phone',
    'address',
    'personalId',
    'emergencyContact',
    ...fieldsToMask
  ];

  const masked = { ...data };
  
  for (const field of sensitiveFields) {
    if (masked[field]) {
      if (typeof masked[field] === 'string') {
        masked[field] = masked[field].substring(0, 2) + '***';
      } else {
        masked[field] = '***';
      }
    }
  }

  return masked;
}

/**
 * Security validation middleware helpers
 */
export function validateRequestIntegrity(
  headers: Record<string, string>,
  body: any,
  expectedChecksum?: string
): boolean {
  // Basic integrity check - in production, implement proper HMAC validation
  const contentLength = headers['content-length'];
  const bodyString = JSON.stringify(body);
  
  if (contentLength && parseInt(contentLength) !== bodyString.length) {
    return false;
  }

  // Additional checksum validation if provided
  if (expectedChecksum) {
    const calculatedChecksum = hashSensitiveData(bodyString);
    return calculatedChecksum === expectedChecksum;
  }

  return true;
}

/**
 * Export security validation utilities
 */
export {
  secureStringSchema,
  secureIdSchema,
  secureDateSchema
};
