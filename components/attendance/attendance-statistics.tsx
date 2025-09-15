'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
    TrendingUp, 
    TrendingDown, 
    Users, 
    UserCheck, 
    UserX, 
    Clock 
} from 'lucide-react';

interface AttendanceStatisticsProps {
    data: {
        present: number;
        absentSick: number;
        absentExcused: number;
        absentUnexcused: number;
        unrecorded: number;
    };
    totalStudents: number;
    date: Date;
    className?: string;
}

export function AttendanceStatistics({
    data,
    totalStudents,
    date,
    className
}: AttendanceStatisticsProps) {
    // Calculate key metrics
    const totalRecorded = data.present + data.absentSick + data.absentExcused + data.absentUnexcused;
    const totalAbsent = data.absentSick + data.absentExcused + data.absentUnexcused;
    
    const attendanceRate = totalRecorded > 0 ? (data.present / totalRecorded) * 100 : 0;
    const recordingRate = totalStudents > 0 ? (totalRecorded / totalStudents) * 100 : 0;
    // const absenteeRate = totalRecorded > 0 ? (totalAbsent / totalRecorded) * 100 : 0;

    // Determine attendance status color and icon
    const getAttendanceStatus = (rate: number) => {
        if (rate >= 90) return { color: 'text-green-600', bgColor: 'bg-green-50', icon: TrendingUp, label: 'Excellent' };
        if (rate >= 80) return { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: TrendingUp, label: 'Good' };
        if (rate >= 70) return { color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: TrendingDown, label: 'Needs Attention' };
        return { color: 'text-red-600', bgColor: 'bg-red-50', icon: TrendingDown, label: 'Poor' };
    };

    const attendanceStatus = getAttendanceStatus(attendanceRate);
    const AttendanceIcon = attendanceStatus.icon;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Attendance Statistics</span>
                    <Badge variant="outline" className="text-sm">
                        {date.toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric',
                            weekday: 'long'
                        })}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Overall Status */}
                    <div className={`p-4 rounded-lg ${attendanceStatus.bgColor}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <AttendanceIcon className={`h-5 w-5 ${attendanceStatus.color}`} />
                                <div>
                                    <div className={`font-medium ${attendanceStatus.color}`}>
                                        {attendanceStatus.label} Attendance
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {attendanceRate.toFixed(1)}% attendance rate
                                    </div>
                                </div>
                            </div>
                            <div className={`text-2xl font-bold ${attendanceStatus.color}`}>
                                {attendanceRate.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                            <UserCheck className="h-6 w-6 text-green-600 mx-auto mb-1" />
                            <div className="text-xl font-bold text-green-600">{data.present}</div>
                            <div className="text-xs text-gray-600">Present</div>
                        </div>
                        
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                            <UserX className="h-6 w-6 text-red-600 mx-auto mb-1" />
                            <div className="text-xl font-bold text-red-600">{totalAbsent}</div>
                            <div className="text-xs text-gray-600">Absent</div>
                        </div>
                        
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Clock className="h-6 w-6 text-gray-600 mx-auto mb-1" />
                            <div className="text-xl font-bold text-gray-600">{data.unrecorded}</div>
                            <div className="text-xs text-gray-600">Unrecorded</div>
                        </div>
                        
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                            <div className="text-xl font-bold text-blue-600">{totalStudents}</div>
                            <div className="text-xs text-gray-600">Total Students</div>
                        </div>
                    </div>

                    {/* Progress Indicators */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Attendance Rate</span>
                                <span className="text-sm text-gray-500">
                                    {data.present}/{totalRecorded} present
                                </span>
                            </div>
                            <Progress 
                                value={attendanceRate} 
                                className="h-2"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">Recording Progress</span>
                                <span className="text-sm text-gray-500">
                                    {totalRecorded}/{totalStudents} recorded
                                </span>
                            </div>
                            <Progress 
                                value={recordingRate} 
                                className="h-2"
                            />
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    {totalAbsent > 0 && (
                        <div>
                            <h4 className="font-medium text-sm text-gray-700 mb-3">Absence Details</h4>
                            <div className="space-y-3">
                                {data.absentSick > 0 && (
                                    <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                                            <span className="text-sm font-medium">Sick Leave</span>
                                            <Badge variant="secondary" className="text-xs">K</Badge>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">{data.absentSick}</div>
                                            <div className="text-xs text-gray-500">
                                                {totalRecorded > 0 ? ((data.absentSick / totalRecorded) * 100).toFixed(1) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {data.absentExcused > 0 && (
                                    <div className="flex justify-between items-center py-2 px-3 bg-yellow-50 rounded">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                            <span className="text-sm font-medium">Excused</span>
                                            <Badge variant="secondary" className="text-xs">E</Badge>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">{data.absentExcused}</div>
                                            <div className="text-xs text-gray-500">
                                                {totalRecorded > 0 ? ((data.absentExcused / totalRecorded) * 100).toFixed(1) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {data.absentUnexcused > 0 && (
                                    <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500" />
                                            <span className="text-sm font-medium">Unexcused</span>
                                            <Badge variant="secondary" className="text-xs">UE</Badge>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">{data.absentUnexcused}</div>
                                            <div className="text-xs text-gray-500">
                                                {totalRecorded > 0 ? ((data.absentUnexcused / totalRecorded) * 100).toFixed(1) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Data Quality Indicator */}
                    <div className="border-t pt-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Data Completeness</span>
                            <div className="flex items-center space-x-2">
                                <span className={`font-medium ${recordingRate === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                                    {recordingRate.toFixed(1)}%
                                </span>
                                {recordingRate === 100 ? (
                                    <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">Partial</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
