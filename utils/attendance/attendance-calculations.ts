import { AttendanceStatus } from '@prisma/client';
import { addDays, format, isWeekend, startOfDay, endOfDay } from 'date-fns';

/**
 * Utility functions for attendance date calculations and statistics
 */

// Types for attendance calculations
export interface AttendanceRecord {
    id: string;
    date: Date;
    status: AttendanceStatus;
    studentId: string;
}

export interface AttendanceStatistics {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    absentSickDays: number;
    absentExcusedDays: number;
    absentUnexcusedDays: number;
    unrecordedDays: number;
    attendanceRate: number;
    absenteeRate: number;
}

export interface CohortAttendanceData {
    cohortId: string;
    cohortName: string;
    totalStudents: number;
    activeStudents: number;
    startDate: Date;
    endDate: Date | null;
    statistics: AttendanceStatistics;
}

export interface StudentAttendanceData {
    studentId: string;
    studentName: string;
    cohortId: string;
    records: AttendanceRecord[];
    statistics: AttendanceStatistics;
    trend: 'improving' | 'declining' | 'stable';
    riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Calculate the number of working days (excluding weekends) between two dates
 */
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        if (!isWeekend(current)) {
            count++;
        }
        current = addDays(current, 1);
    }

    return count;
}

/**
 * Calculate the total number of working days for a cohort up to the current date or cohort end date
 */
export function calculateCohortWorkingDays(cohortStartDate: Date, cohortEndDate?: Date | null): number {
    const endDate = cohortEndDate || new Date();
    const actualEndDate = endDate > new Date() ? new Date() : endDate;
    
    return calculateWorkingDays(cohortStartDate, actualEndDate);
}

/**
 * Get all working days between two dates as an array
 */
export function getWorkingDaysBetween(startDate: Date, endDate: Date): Date[] {
    const workingDays: Date[] = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        if (!isWeekend(current)) {
            workingDays.push(new Date(current));
        }
        current = addDays(current, 1);
    }

    return workingDays;
}

/**
 * Check if a given date is a valid attendance date (working day, not in future)
 */
export function isValidAttendanceDate(date: Date, cohortStartDate: Date, cohortEndDate?: Date | null): boolean {
    const now = new Date();
    const checkDate = startOfDay(date);
    const cohortStart = startOfDay(cohortStartDate);
    const cohortEnd = cohortEndDate ? startOfDay(cohortEndDate) : endOfDay(now);

    // Must be a weekday
    if (isWeekend(checkDate)) {
        return false;
    }

    // Must be within cohort dates
    if (checkDate < cohortStart || checkDate > cohortEnd) {
        return false;
    }

    // Must not be in the future
    if (checkDate > startOfDay(now)) {
        return false;
    }

    return true;
}

/**
 * Calculate attendance statistics for a student
 */
export function calculateStudentAttendanceStatistics(
    records: AttendanceRecord[],
    totalWorkingDays: number
): AttendanceStatistics {
    const presentDays = records.filter(r => r.status === AttendanceStatus.PRESENT).length;
    const absentSickDays = records.filter(r => r.status === AttendanceStatus.ABSENT_SICK).length;
    const absentExcusedDays = records.filter(r => r.status === AttendanceStatus.ABSENT_EXCUSED).length;
    const absentUnexcusedDays = records.filter(r => r.status === AttendanceStatus.ABSENT_UNEXCUSED).length;
    
    const absentDays = absentSickDays + absentExcusedDays + absentUnexcusedDays;
    const recordedDays = presentDays + absentDays;
    const unrecordedDays = Math.max(0, totalWorkingDays - recordedDays);
    
    const attendanceRate = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;
    const absenteeRate = totalWorkingDays > 0 ? (absentDays / totalWorkingDays) * 100 : 0;

    return {
        totalDays: totalWorkingDays,
        presentDays,
        absentDays,
        absentSickDays,
        absentExcusedDays,
        absentUnexcusedDays,
        unrecordedDays,
        attendanceRate: Math.round(attendanceRate * 100) / 100, // Round to 2 decimal places
        absenteeRate: Math.round(absenteeRate * 100) / 100
    };
}

/**
 * Calculate cohort-wide attendance statistics
 */
export function calculateCohortAttendanceStatistics(
    studentStatistics: AttendanceStatistics[]
): AttendanceStatistics {
    if (studentStatistics.length === 0) {
        return {
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            absentSickDays: 0,
            absentExcusedDays: 0,
            absentUnexcusedDays: 0,
            unrecordedDays: 0,
            attendanceRate: 0,
            absenteeRate: 0
        };
    }

    const totals = studentStatistics.reduce(
        (acc, stats) => ({
            totalDays: acc.totalDays + stats.totalDays,
            presentDays: acc.presentDays + stats.presentDays,
            absentDays: acc.absentDays + stats.absentDays,
            absentSickDays: acc.absentSickDays + stats.absentSickDays,
            absentExcusedDays: acc.absentExcusedDays + stats.absentExcusedDays,
            absentUnexcusedDays: acc.absentUnexcusedDays + stats.absentUnexcusedDays,
            unrecordedDays: acc.unrecordedDays + stats.unrecordedDays
        }),
        {
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            absentSickDays: 0,
            absentExcusedDays: 0,
            absentUnexcusedDays: 0,
            unrecordedDays: 0
        }
    );

    const attendanceRate = totals.totalDays > 0 ? (totals.presentDays / totals.totalDays) * 100 : 0;
    const absenteeRate = totals.totalDays > 0 ? (totals.absentDays / totals.totalDays) * 100 : 0;

    return {
        ...totals,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        absenteeRate: Math.round(absenteeRate * 100) / 100
    };
}

/**
 * Calculate attendance trend for a student (based on recent performance)
 */
export function calculateAttendanceTrend(records: AttendanceRecord[], recentDays: number = 14): 'improving' | 'declining' | 'stable' {
    if (records.length < 4) {
        return 'stable'; // Not enough data
    }

    // Sort records by date (most recent first)
    const sortedRecords = [...records].sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Take recent records
    const recentRecords = sortedRecords.slice(0, Math.min(recentDays, sortedRecords.length));
    const olderRecords = sortedRecords.slice(recentRecords.length);

    if (olderRecords.length === 0) {
        return 'stable';
    }

    // Calculate attendance rates for recent and older periods
    const recentPresentCount = recentRecords.filter(r => r.status === AttendanceStatus.PRESENT).length;
    const recentAttendanceRate = recentPresentCount / recentRecords.length;

    const olderPresentCount = olderRecords.filter(r => r.status === AttendanceStatus.PRESENT).length;
    const olderAttendanceRate = olderPresentCount / olderRecords.length;

    const difference = recentAttendanceRate - olderAttendanceRate;

    // Consider significant if difference is > 10%
    if (difference > 0.1) {
        return 'improving';
    } else if (difference < -0.1) {
        return 'declining';
    } else {
        return 'stable';
    }
}

/**
 * Determine risk level based on attendance statistics
 */
export function calculateRiskLevel(statistics: AttendanceStatistics): 'low' | 'medium' | 'high' {
    const { attendanceRate, absentUnexcusedDays, totalDays } = statistics;

    // High risk conditions
    if (attendanceRate < 75 || (absentUnexcusedDays / totalDays) > 0.15) {
        return 'high';
    }

    // Medium risk conditions
    if (attendanceRate < 85 || (absentUnexcusedDays / totalDays) > 0.05) {
        return 'medium';
    }

    // Low risk
    return 'low';
}

/**
 * Get missing attendance dates for a student within a date range
 */
export function getMissingAttendanceDates(
    records: AttendanceRecord[],
    startDate: Date,
    endDate: Date
): Date[] {
    const workingDays = getWorkingDaysBetween(startDate, endDate);
    const recordedDates = new Set(
        records.map(r => format(r.date, 'yyyy-MM-dd'))
    );

    return workingDays.filter(date => 
        !recordedDates.has(format(date, 'yyyy-MM-dd'))
    );
}

/**
 * Calculate attendance streak (consecutive present days)
 */
export function calculateAttendanceStreak(records: AttendanceRecord[]): {
    currentStreak: number;
    longestStreak: number;
    type: 'present' | 'absent';
} {
    if (records.length === 0) {
        return { currentStreak: 0, longestStreak: 0, type: 'present' };
    }

    // Sort by date (most recent first)
    const sortedRecords = [...records].sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let currentStreak = 0;
    let longestStreak = 0;
    let currentStreakType: 'present' | 'absent' = 'present';
    let tempStreak = 0;
    let tempType: 'present' | 'absent' | null = null;

    // Calculate current streak
    for (const record of sortedRecords) {
        const isPresent = record.status === AttendanceStatus.PRESENT;
        
        if (currentStreak === 0) {
            currentStreak = 1;
            currentStreakType = isPresent ? 'present' : 'absent';
        } else if (
            (currentStreakType === 'present' && isPresent) ||
            (currentStreakType === 'absent' && !isPresent)
        ) {
            currentStreak++;
        } else {
            break; // Streak broken
        }
    }

    // Calculate longest streak
    for (const record of sortedRecords) {
        const isPresent = record.status === AttendanceStatus.PRESENT;
        const recordType: 'present' | 'absent' = isPresent ? 'present' : 'absent';
        
        if (tempType === null || tempType === recordType) {
            tempStreak++;
            tempType = recordType;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
            tempType = recordType;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
        currentStreak,
        longestStreak,
        type: currentStreakType
    };
}

/**
 * Calculate monthly attendance summary
 */
export function calculateMonthlyAttendance(
    records: AttendanceRecord[],
    year: number,
    month: number
): AttendanceStatistics & { month: number; year: number } {
    const monthRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === year && recordDate.getMonth() === month - 1;
    });

    // Calculate working days in the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const workingDaysInMonth = calculateWorkingDays(firstDay, lastDay);

    const statistics = calculateStudentAttendanceStatistics(monthRecords, workingDaysInMonth);

    return {
        ...statistics,
        month,
        year
    };
}

/**
 * Format attendance rate for display
 */
export function formatAttendanceRate(rate: number): string {
    return `${Math.round(rate * 10) / 10}%`;
}

/**
 * Get attendance status color for UI display
 */
export function getAttendanceStatusColor(status: AttendanceStatus): {
    color: string;
    bgColor: string;
    borderColor: string;
} {
    switch (status) {
        case AttendanceStatus.PRESENT:
            return {
                color: 'text-green-700',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-200'
            };
        case AttendanceStatus.ABSENT_SICK:
            return {
                color: 'text-blue-700',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-200'
            };
        case AttendanceStatus.ABSENT_EXCUSED:
            return {
                color: 'text-yellow-700',
                bgColor: 'bg-yellow-50',
                borderColor: 'border-yellow-200'
            };
        case AttendanceStatus.ABSENT_UNEXCUSED:
            return {
                color: 'text-red-700',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200'
            };
        default:
            return {
                color: 'text-gray-700',
                bgColor: 'bg-gray-50',
                borderColor: 'border-gray-200'
            };
    }
}

/**
 * Get risk level styling for UI display
 */
export function getRiskLevelStyling(riskLevel: 'low' | 'medium' | 'high'): {
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
} {
    switch (riskLevel) {
        case 'low':
            return {
                color: 'text-green-700',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-200',
                label: 'Low Risk'
            };
        case 'medium':
            return {
                color: 'text-yellow-700',
                bgColor: 'bg-yellow-50',
                borderColor: 'border-yellow-200',
                label: 'Medium Risk'
            };
        case 'high':
            return {
                color: 'text-red-700',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                label: 'High Risk'
            };
    }
}
