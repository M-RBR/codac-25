'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AttendanceData {
    name: string;
    value: number;
    color: string;
    shortCode: string;
    description: string;
}

interface AttendancePieChartProps {
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

export function AttendancePieChart({
    data,
    totalStudents,
    date,
    className
}: AttendancePieChartProps) {
    // Prepare data for the pie chart
    const chartData: AttendanceData[] = [
        {
            name: 'Present',
            value: data.present,
            color: '#22c55e', // green-500
            shortCode: 'Y',
            description: 'Students present and participating'
        },
        {
            name: 'Sick Leave',
            value: data.absentSick,
            color: '#3b82f6', // blue-500
            shortCode: 'K',
            description: 'Students absent due to illness with documentation'
        },
        {
            name: 'Excused',
            value: data.absentExcused,
            color: '#eab308', // yellow-500
            shortCode: 'E',
            description: 'Students absent with prior approval'
        },
        {
            name: 'Unexcused',
            value: data.absentUnexcused,
            color: '#ef4444', // red-500
            shortCode: 'UE',
            description: 'Students absent without approval'
        },
        {
            name: 'Unrecorded',
            value: data.unrecorded,
            color: '#6b7280', // gray-500
            shortCode: '—',
            description: 'Attendance not yet recorded'
        }
    ].filter(item => item.value > 0); // Only show categories with data

    // Calculate totals for summary
    const totalRecorded = data.present + data.absentSick + data.absentExcused + data.absentUnexcused;
    const totalAbsent = data.absentSick + data.absentExcused + data.absentUnexcused;
    const attendanceRate = totalRecorded > 0 ? (data.present / totalRecorded) * 100 : 0;

    // Custom tooltip component
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const percentage = totalStudents > 0 ? (data.value / totalStudents * 100).toFixed(1) : 0;
            
            return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <div className="flex items-center space-x-2 mb-1">
                        <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: data.color }}
                        />
                        <span className="font-medium">{data.name}</span>
                        <Badge variant="secondary" className="text-xs">
                            {data.shortCode}
                        </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{data.description}</p>
                    <p className="text-sm">
                        <span className="font-bold">{data.value}</span> students 
                        <span className="text-gray-500"> ({percentage}%)</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom legend component
    const CustomLegend = ({ payload }: any) => {
        return (
            <div className="flex flex-wrap justify-center gap-4 mt-4">
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                        <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm text-gray-700">{entry.value}</span>
                        <Badge variant="outline" className="text-xs">
                            {chartData.find(d => d.name === entry.value)?.shortCode}
                        </Badge>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Daily Attendance Overview</span>
                    <Badge variant="outline" className="text-sm">
                        {date.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            weekday: 'short'
                        })}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {totalStudents === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No students found in this cohort</p>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No attendance data recorded for this date</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{data.present}</div>
                                <div className="text-sm text-gray-500">Present</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{totalAbsent}</div>
                                <div className="text-sm text-gray-500">Absent</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-600">{data.unrecorded}</div>
                                <div className="text-sm text-gray-500">Unrecorded</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {attendanceRate.toFixed(1)}%
                                </div>
                                <div className="text-sm text-gray-500">Attendance Rate</div>
                            </div>
                        </div>

                        {/* Pie Chart */}
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value, percent }) => 
                                            `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                                        }
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        strokeWidth={2}
                                        stroke="#ffffff"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend content={<CustomLegend />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Detailed Breakdown */}
                        {totalAbsent > 0 && (
                            <div>
                                <h4 className="font-medium text-sm text-gray-700 mb-3">Absence Breakdown</h4>
                                <div className="space-y-2">
                                    {data.absentSick > 0 && (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                                <span className="text-sm">Sick Leave (K)</span>
                                            </div>
                                            <span className="text-sm font-medium">{data.absentSick}</span>
                                        </div>
                                    )}
                                    {data.absentExcused > 0 && (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                                <span className="text-sm">Excused (E)</span>
                                            </div>
                                            <span className="text-sm font-medium">{data.absentExcused}</span>
                                        </div>
                                    )}
                                    {data.absentUnexcused > 0 && (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                                <span className="text-sm">Unexcused (UE)</span>
                                            </div>
                                            <span className="text-sm font-medium">{data.absentUnexcused}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
