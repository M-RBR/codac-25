'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AttendanceSegment {
    type: 'present' | 'absent-sick' | 'absent-excused' | 'absent-unexcused' | 'unrecorded';
    percentage: number;
    count: number;
    color: string;
    label: string;
    shortCode: string;
}

interface AttendanceProgressBarProps {
    segments: AttendanceSegment[];
    totalDays: number;
    presentDays: number;
    className?: string;
    showPercentage?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function AttendanceProgressBar({
    segments,
    totalDays,
    presentDays,
    className,
    showPercentage = true,
    size = 'md'
}: AttendanceProgressBarProps) {
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
    
    // Size variants
    const sizeClasses = {
        sm: 'h-4',
        md: 'h-6',
        lg: 'h-8'
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    return (
        <TooltipProvider>
            <div className={cn('space-y-2', className)}>
                {/* Progress Bar Container */}
                <div 
                    className={cn(
                        'relative w-full bg-gray-200 rounded-full overflow-hidden border',
                        sizeClasses[size]
                    )}
                >
                    {segments.map((segment, index) => (
                        segment.percentage > 0 && (
                            <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            'absolute top-0 h-full transition-all duration-300 hover:brightness-110',
                                            segment.color
                                        )}
                                        style={{
                                            left: `${segments.slice(0, index).reduce((acc, s) => acc + s.percentage, 0)}%`,
                                            width: `${segment.percentage}%`
                                        }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="text-center">
                                        <div className="font-medium">{segment.label}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {segment.count} days ({segment.percentage.toFixed(1)}%)
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        )
                    ))}
                </div>

                {/* Percentage Display */}
                {showPercentage && (
                    <div className="flex items-center justify-between">
                        <div className={cn('font-medium', textSizeClasses[size])}>
                            Attendance: {attendanceRate.toFixed(1)}%
                        </div>
                        <div className={cn('text-muted-foreground', textSizeClasses[size])}>
                            {presentDays}/{totalDays} days
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-2">
                    {segments.filter(segment => segment.count > 0).map((segment, index) => (
                        <div key={index} className="flex items-center space-x-1">
                            <div 
                                className={cn('w-3 h-3 rounded-full', segment.color)}
                            />
                            <Badge variant="outline" className="text-xs">
                                {segment.shortCode}
                            </Badge>
                            <span className="text-xs text-gray-600">
                                {segment.count}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
}

// Utility function to create segments from attendance data
export function createAttendanceSegments(attendanceData: {
    present: number;
    absentSick: number;
    absentExcused: number;
    absentUnexcused: number;
    unrecorded: number;
}, totalDays: number): AttendanceSegment[] {
    const segments: AttendanceSegment[] = [
        {
            type: 'present',
            count: attendanceData.present,
            percentage: totalDays > 0 ? (attendanceData.present / totalDays) * 100 : 0,
            color: 'bg-green-500',
            label: 'Present',
            shortCode: 'Y'
        },
        {
            type: 'absent-sick',
            count: attendanceData.absentSick,
            percentage: totalDays > 0 ? (attendanceData.absentSick / totalDays) * 100 : 0,
            color: 'bg-blue-500',
            label: 'Sick Leave',
            shortCode: 'K'
        },
        {
            type: 'absent-excused',
            count: attendanceData.absentExcused,
            percentage: totalDays > 0 ? (attendanceData.absentExcused / totalDays) * 100 : 0,
            color: 'bg-yellow-500',
            label: 'Excused Absence',
            shortCode: 'E'
        },
        {
            type: 'absent-unexcused',
            count: attendanceData.absentUnexcused,
            percentage: totalDays > 0 ? (attendanceData.absentUnexcused / totalDays) * 100 : 0,
            color: 'bg-red-500',
            label: 'Unexcused Absence',
            shortCode: 'UE'
        },
        {
            type: 'unrecorded',
            count: attendanceData.unrecorded,
            percentage: totalDays > 0 ? (attendanceData.unrecorded / totalDays) * 100 : 0,
            color: 'bg-gray-400',
            label: 'Unrecorded',
            shortCode: '—'
        }
    ];

    return segments;
}

