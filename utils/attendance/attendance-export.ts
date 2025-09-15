import { AttendanceStatus } from '@prisma/client';
import { format, parseISO } from 'date-fns';

import { AttendanceStatistics, StudentAttendanceData, CohortAttendanceData } from './attendance-calculations';

/**
 * Utility functions for exporting and importing attendance data
 */

// Export format types
export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface ExportOptions {
    format: ExportFormat;
    includeStatistics?: boolean;
    dateRange?: {
        startDate: Date;
        endDate: Date;
    };
    includeMetadata?: boolean;
}

export interface AttendanceExportData {
    metadata: {
        exportDate: string;
        cohortName: string;
        cohortId: string;
        dateRange: {
            startDate: string;
            endDate: string;
        };
        totalStudents: number;
        totalWorkingDays: number;
    };
    students: Array<{
        studentId: string;
        studentName: string;
        email?: string;
        statistics: AttendanceStatistics;
        records: Array<{
            date: string;
            status: AttendanceStatus;
            statusLabel: string;
        }>;
    }>;
    cohortStatistics?: AttendanceStatistics;
}

/**
 * Convert attendance status to human-readable label
 */
export function getAttendanceStatusLabel(status: AttendanceStatus): string {
    switch (status) {
        case AttendanceStatus.PRESENT:
            return 'Present';
        case AttendanceStatus.ABSENT_SICK:
            return 'Absent - Sick';
        case AttendanceStatus.ABSENT_EXCUSED:
            return 'Absent - Excused';
        case AttendanceStatus.ABSENT_UNEXCUSED:
            return 'Absent - Unexcused';
        default:
            return 'Unknown';
    }
}

/**
 * Convert attendance status to short code
 */
export function getAttendanceStatusCode(status: AttendanceStatus): string {
    switch (status) {
        case AttendanceStatus.PRESENT:
            return 'P';
        case AttendanceStatus.ABSENT_SICK:
            return 'S';
        case AttendanceStatus.ABSENT_EXCUSED:
            return 'E';
        case AttendanceStatus.ABSENT_UNEXCUSED:
            return 'U';
        default:
            return '?';
    }
}

/**
 * Prepare attendance data for export
 */
export function prepareAttendanceExportData(
    cohortData: CohortAttendanceData,
    studentData: StudentAttendanceData[],
    options: ExportOptions
): AttendanceExportData {
    const { dateRange } = options;
    const startDate = dateRange?.startDate || cohortData.startDate;
    const endDate = dateRange?.endDate || cohortData.endDate || new Date();

    return {
        metadata: {
            exportDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            cohortName: cohortData.cohortName,
            cohortId: cohortData.cohortId,
            dateRange: {
                startDate: format(startDate, 'yyyy-MM-dd'),
                endDate: format(endDate, 'yyyy-MM-dd')
            },
            totalStudents: studentData.length,
            totalWorkingDays: cohortData.statistics.totalDays
        },
        students: studentData.map(student => ({
            studentId: student.studentId,
            studentName: student.studentName,
            statistics: student.statistics,
            records: student.records
                .filter(record => {
                    const recordDate = new Date(record.date);
                    return recordDate >= startDate && recordDate <= endDate;
                })
                .map(record => ({
                    date: format(record.date, 'yyyy-MM-dd'),
                    status: record.status,
                    statusLabel: getAttendanceStatusLabel(record.status)
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
        })),
        cohortStatistics: options.includeStatistics ? cohortData.statistics : undefined
    };
}

/**
 * Generate CSV format attendance export
 */
export function generateCSVExport(data: AttendanceExportData): string {
    const lines: string[] = [];
    
    // Add metadata header if requested
    if (data.metadata) {
        lines.push('# Attendance Export Metadata');
        lines.push('# Export Date: ' + data.metadata.exportDate);
        lines.push('# Cohort: ' + data.metadata.cohortName + ' (' + data.metadata.cohortId + ')');
        lines.push('# Date Range: ' + data.metadata.dateRange.startDate + ' to ' + data.metadata.dateRange.endDate);
        lines.push('# Total Students: ' + data.metadata.totalStudents);
        lines.push('# Total Working Days: ' + data.metadata.totalWorkingDays);
        lines.push('');
    }

    // Student statistics summary
    lines.push('# Student Statistics Summary');
    lines.push('Student ID,Student Name,Total Days,Present Days,Absent Days,Attendance Rate %,Risk Level');
    
    data.students.forEach(student => {
        const stats = student.statistics;
        lines.push([
            student.studentId,
            '"' + student.studentName + '"',
            stats.totalDays,
            stats.presentDays,
            stats.absentDays,
            stats.attendanceRate.toFixed(2),
            // Add risk level calculation here
            stats.attendanceRate >= 85 ? 'Low' : stats.attendanceRate >= 75 ? 'Medium' : 'High'
        ].join(','));
    });

    lines.push('');

    // Daily attendance records
    lines.push('# Daily Attendance Records');
    lines.push('Student ID,Student Name,Date,Status,Status Code');

    data.students.forEach(student => {
        student.records.forEach(record => {
            lines.push([
                student.studentId,
                '"' + student.studentName + '"',
                record.date,
                '"' + record.statusLabel + '"',
                getAttendanceStatusCode(record.status)
            ].join(','));
        });
    });

    // Cohort statistics if included
    if (data.cohortStatistics) {
        lines.push('');
        lines.push('# Cohort Statistics');
        lines.push('Metric,Value');
        lines.push('Total Days,' + data.cohortStatistics.totalDays);
        lines.push('Present Days,' + data.cohortStatistics.presentDays);
        lines.push('Absent Days,' + data.cohortStatistics.absentDays);
        lines.push('Sick Days,' + data.cohortStatistics.absentSickDays);
        lines.push('Excused Absent Days,' + data.cohortStatistics.absentExcusedDays);
        lines.push('Unexcused Absent Days,' + data.cohortStatistics.absentUnexcusedDays);
        lines.push('Unrecorded Days,' + data.cohortStatistics.unrecordedDays);
        lines.push('Attendance Rate %,' + data.cohortStatistics.attendanceRate.toFixed(2));
        lines.push('Absentee Rate %,' + data.cohortStatistics.absenteeRate.toFixed(2));
    }

    return lines.join('\n');
}

/**
 * Generate JSON format attendance export
 */
export function generateJSONExport(data: AttendanceExportData): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Generate attendance summary report
 */
export function generateAttendanceSummaryReport(
    cohortData: CohortAttendanceData,
    studentData: StudentAttendanceData[]
): string {
    const lines: string[] = [];
    
    lines.push('ATTENDANCE SUMMARY REPORT');
    lines.push('========================');
    lines.push('');
    lines.push('Cohort: ' + cohortData.cohortName);
    lines.push('Report Date: ' + format(new Date(), 'MMMM d, yyyy'));
    lines.push('Period: ' + format(cohortData.startDate, 'MMM d, yyyy') + ' - ' + (cohortData.endDate ? format(cohortData.endDate, 'MMM d, yyyy') : 'Present'));
    lines.push('');
    
    // Cohort overview
    lines.push('COHORT OVERVIEW');
    lines.push('---------------');
    lines.push('Total Students: ' + cohortData.totalStudents);
    lines.push('Active Students: ' + cohortData.activeStudents);
    lines.push('Total Working Days: ' + cohortData.statistics.totalDays);
    lines.push('Overall Attendance Rate: ' + cohortData.statistics.attendanceRate.toFixed(1) + '%');
    lines.push('');

    // Risk analysis
    const riskAnalysis = {
        high: studentData.filter(s => s.riskLevel === 'high').length,
        medium: studentData.filter(s => s.riskLevel === 'medium').length,
        low: studentData.filter(s => s.riskLevel === 'low').length
    };

    lines.push('RISK ANALYSIS');
    lines.push('-------------');
    lines.push('High Risk Students: ' + riskAnalysis.high + ' (' + ((riskAnalysis.high / studentData.length) * 100).toFixed(1) + '%)');
    lines.push('Medium Risk Students: ' + riskAnalysis.medium + ' (' + ((riskAnalysis.medium / studentData.length) * 100).toFixed(1) + '%)');
    lines.push('Low Risk Students: ' + riskAnalysis.low + ' (' + ((riskAnalysis.low / studentData.length) * 100).toFixed(1) + '%)');
    lines.push('');

    // Top performers
    const topPerformers = [...studentData]
        .sort((a, b) => b.statistics.attendanceRate - a.statistics.attendanceRate)
        .slice(0, 5);

    lines.push('TOP PERFORMERS');
    lines.push('--------------');
    topPerformers.forEach((student, index) => {
        lines.push((index + 1) + '. ' + student.studentName + ': ' + student.statistics.attendanceRate.toFixed(1) + '%');
    });
    lines.push('');

    // Students needing attention
    const needingAttention = studentData
        .filter(s => s.riskLevel === 'high' || s.statistics.attendanceRate < 80)
        .sort((a, b) => a.statistics.attendanceRate - b.statistics.attendanceRate);

    if (needingAttention.length > 0) {
        lines.push('STUDENTS NEEDING ATTENTION');
        lines.push('--------------------------');
        needingAttention.forEach(student => {
            lines.push('• ' + student.studentName + ': ' + student.statistics.attendanceRate.toFixed(1) + '% (' + student.riskLevel + ' risk)');
            lines.push('  - Unexcused absences: ' + student.statistics.absentUnexcusedDays);
            lines.push('  - Trend: ' + student.trend);
        });
        lines.push('');
    }

    // Recommendations
    lines.push('RECOMMENDATIONS');
    lines.push('---------------');
    
    if (cohortData.statistics.attendanceRate < 85) {
        lines.push('• Overall cohort attendance is below target (85%). Consider:');
        lines.push('  - Reviewing attendance policies');
        lines.push('  - Implementing attendance incentives');
        lines.push('  - Identifying common absence patterns');
    }
    
    if (riskAnalysis.high > 0) {
        lines.push('• ' + riskAnalysis.high + ' students are at high risk. Recommend:');
        lines.push('  - Individual meetings with at-risk students');
        lines.push('  - Academic support interventions');
        lines.push('  - Monitoring attendance trends closely');
    }

    if (needingAttention.some(s => s.trend === 'declining')) {
        lines.push('• Some students show declining attendance trends. Consider:');
        lines.push('  - Early intervention strategies');
        lines.push('  - Peer support programs');
        lines.push('  - Regular check-ins');
    }

    return lines.join('\n');
}

/**
 * Parse CSV attendance data for import
 */
export function parseCSVAttendanceData(csvContent: string): {
    success: boolean;
    data?: Array<{
        studentId: string;
        date: string;
        status: AttendanceStatus;
    }>;
    errors?: string[];
} {
    const errors: string[] = [];
    const data: Array<{
        studentId: string;
        date: string;
        status: AttendanceStatus;
    }> = [];

    try {
        const lines = csvContent.trim().split('\n');
        
        // Skip header and metadata lines
        const dataLines = lines.filter(line => 
            !line.startsWith('#') && 
            !line.startsWith('Student ID,Student Name,Date') &&
            line.trim().length > 0
        );

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            const parts = line.split(',');
            
            if (parts.length < 4) {
                errors.push('Line ' + (i + 1) + ': Invalid format - expected at least 4 columns');
                continue;
            }

            const studentId = parts[0].trim();
            const date = parts[2].trim();
            const statusCode = parts[4].trim();

            // Validate student ID
            if (!studentId) {
                errors.push('Line ' + (i + 1) + ': Missing student ID');
                continue;
            }

            // Validate date
            const parsedDate = parseISO(date);
            if (isNaN(parsedDate.getTime())) {
                errors.push('Line ' + (i + 1) + ': Invalid date format - ' + date);
                continue;
            }

            // Convert status code to AttendanceStatus
            let status: AttendanceStatus;
            switch (statusCode.toUpperCase()) {
                case 'P':
                    status = AttendanceStatus.PRESENT;
                    break;
                case 'S':
                    status = AttendanceStatus.ABSENT_SICK;
                    break;
                case 'E':
                    status = AttendanceStatus.ABSENT_EXCUSED;
                    break;
                case 'U':
                    status = AttendanceStatus.ABSENT_UNEXCUSED;
                    break;
                default:
                    errors.push('Line ' + (i + 1) + ': Invalid status code - ' + statusCode);
                    continue;
            }

            data.push({
                studentId,
                date,
                status
            });
        }

        return {
            success: errors.length === 0,
            data: errors.length === 0 ? data : undefined,
            errors: errors.length > 0 ? errors : undefined
        };

    } catch (error) {
        return {
            success: false,
            errors: ['Parse error: ' + (error instanceof Error ? error.message : String(error))]
        };
    }
}

/**
 * Validate import data against business rules
 */
export function validateImportData(
    importData: Array<{
        studentId: string;
        date: string;
        status: AttendanceStatus;
    }>,
    cohortStartDate: Date,
    cohortEndDate?: Date | null
): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    const now = new Date();
    const endDate = cohortEndDate || now;

    for (const record of importData) {
        const recordDate = parseISO(record.date);
        
        // Check if date is within cohort period
        if (recordDate < cohortStartDate) {
            errors.push('Date ' + record.date + ' is before cohort start date');
        }
        
        if (recordDate > endDate) {
            errors.push('Date ' + record.date + ' is after cohort end date');
        }

        // Check if date is in the future
        if (recordDate > now) {
            errors.push('Date ' + record.date + ' is in the future');
        }

        // Check if date is a weekend
        if (recordDate.getDay() === 0 || recordDate.getDay() === 6) {
            warnings.push('Date ' + record.date + ' is a weekend');
        }

        // Check for very old dates (more than 30 days)
        const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
            warnings.push('Date ' + record.date + ' is more than 30 days old');
        }
    }

    // Check for duplicate records
    const seen = new Set<string>();
    for (const record of importData) {
        const key = record.studentId + '-' + record.date;
        if (seen.has(key)) {
            errors.push('Duplicate record found for student ' + record.studentId + ' on ' + record.date);
        }
        seen.add(key);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
