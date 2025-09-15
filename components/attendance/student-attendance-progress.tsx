'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { AttendanceProgressBar, createAttendanceSegments } from './attendance-progress-bar';
import { cn } from '@/lib/utils';

interface StudentAttendanceData {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    attendanceStats: {
        present: number;
        absentSick: number;
        absentExcused: number;
        absentUnexcused: number;
        unrecorded: number;
        totalDays: number;
    };
}

interface StudentAttendanceProgressProps {
    students: StudentAttendanceData[];
    totalWorkingDays: number;
    className?: string;
}

export function StudentAttendanceProgress({
    students,
    totalWorkingDays,
    className
}: StudentAttendanceProgressProps) {
    // Sort students by attendance rate (highest first)
    const sortedStudents = [...students].sort((a, b) => {
        const rateA = a.attendanceStats.totalDays > 0 
            ? (a.attendanceStats.present / a.attendanceStats.totalDays) * 100 
            : 0;
        const rateB = b.attendanceStats.totalDays > 0 
            ? (b.attendanceStats.present / b.attendanceStats.totalDays) * 100 
            : 0;
        return rateB - rateA;
    });

    const getAttendanceStatus = (attendanceRate: number) => {
        if (attendanceRate >= 95) return { 
            icon: TrendingUp, 
            color: 'text-green-600', 
            bgColor: 'bg-green-50', 
            label: 'Excellent',
            borderColor: 'border-green-200'
        };
        if (attendanceRate >= 85) return { 
            icon: TrendingUp, 
            color: 'text-blue-600', 
            bgColor: 'bg-blue-50', 
            label: 'Good',
            borderColor: 'border-blue-200'
        };
        if (attendanceRate >= 75) return { 
            icon: AlertTriangle, 
            color: 'text-yellow-600', 
            bgColor: 'bg-yellow-50', 
            label: 'At Risk',
            borderColor: 'border-yellow-200'
        };
        return { 
            icon: TrendingDown, 
            color: 'text-red-600', 
            bgColor: 'bg-red-50', 
            label: 'Poor',
            borderColor: 'border-red-200'
        };
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Individual Student Progress</span>
                    <Badge variant="outline" className="ml-auto">
                        {students.length} Students
                    </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Showing attendance progress based on {totalWorkingDays} total course days
                </p>
            </CardHeader>
            <CardContent>
                {students.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No students found in this cohort</p>
                    </div>
                ) : (
                    <ScrollArea className="h-96">
                        <div className="space-y-4">
                            {sortedStudents.map((student, index) => {
                                const attendanceRate = student.attendanceStats.totalDays > 0 
                                    ? (student.attendanceStats.present / student.attendanceStats.totalDays) * 100 
                                    : 0;
                                
                                const status = getAttendanceStatus(attendanceRate);
                                const StatusIcon = status.icon;
                                
                                const segments = createAttendanceSegments(
                                    student.attendanceStats,
                                    student.attendanceStats.totalDays
                                );

                                return (
                                    <div 
                                        key={student.id}
                                        className={cn(
                                            'p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md',
                                            status.bgColor,
                                            status.borderColor
                                        )}
                                    >
                                        {/* Student Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex-shrink-0">
                                                    {student.avatar ? (
                                                        <img 
                                                            src={student.avatar} 
                                                            alt={student.name}
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <User className="h-4 w-4 text-gray-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm">{student.name}</div>
                                                    <div className="text-xs text-gray-500">{student.email}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                                <Badge 
                                                    variant="secondary" 
                                                    className={cn('text-xs', status.color)}
                                                >
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {status.label}
                                                </Badge>
                                                <div className={cn('text-lg font-bold', status.color)}>
                                                    {attendanceRate.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <AttendanceProgressBar
                                            segments={segments}
                                            totalDays={student.attendanceStats.totalDays}
                                            presentDays={student.attendanceStats.present}
                                            size="sm"
                                            showPercentage={false}
                                        />

                                        {/* Quick Stats */}
                                        <div className="flex justify-between items-center mt-3 text-xs text-gray-600">
                                            <div className="flex space-x-4">
                                                <span>Present: {student.attendanceStats.present}</span>
                                                <span>Absent: {
                                                    student.attendanceStats.absentSick + 
                                                    student.attendanceStats.absentExcused + 
                                                    student.attendanceStats.absentUnexcused
                                                }</span>
                                                {student.attendanceStats.unrecorded > 0 && (
                                                    <span>Unrecorded: {student.attendanceStats.unrecorded}</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span>Rank: #{index + 1}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}

