'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Users, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format, isWeekend, subDays, addDays } from 'date-fns';

import { PageErrorBoundary, SectionErrorBoundary } from '@/components/error';
import { Grid, PageContainer, PageHeader, Section } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AttendanceStatus } from '@prisma/client';
import { getCohortForAttendance } from '@/data/attendance/get-cohort-for-attendance';
import { getCohortAttendanceForDate } from '@/data/attendance/get-cohort-attendance-for-date';
import { bulkUpdateAttendance } from '@/actions/attendance/bulk-update-attendance';
import { AttendanceStatusDropdown } from '@/components/attendance/attendance-status-dropdown';
import { AttendancePieChart } from '@/components/attendance/attendance-pie-chart';
import { AttendanceStatistics } from '@/components/attendance/attendance-statistics';
import { StudentAttendanceProgress } from '@/components/attendance/student-attendance-progress';
import { getStudentAttendanceSummary } from '@/data/attendance/get-student-attendance-summary';

export const dynamic = 'force-dynamic';

interface CohortAttendancePageProps {
    params: Promise<{
        cohortSlug: string;
    }>;
    searchParams: Promise<{
        date?: string;
    }>;
}

// Helper function to get a valid weekday (skip weekends)
function getValidAttendanceDate(dateInput?: string): Date {
    let targetDate: Date;
    
    if (dateInput) {
        targetDate = new Date(dateInput);
        // Validate the date
        if (isNaN(targetDate.getTime())) {
            targetDate = new Date();
        }
    } else {
        targetDate = new Date();
    }
    
    // If it's a weekend, go back to the previous Friday
    while (isWeekend(targetDate)) {
        targetDate = subDays(targetDate, 1);
    }
    
    // Ensure it's not in the future
    const today = new Date();
    if (targetDate > today) {
        targetDate = today;
        // If today is a weekend, go back to the previous Friday
        while (isWeekend(targetDate)) {
            targetDate = subDays(targetDate, 1);
        }
    }
    
    return targetDate;
}

export default function CohortAttendancePage({ params, searchParams }: CohortAttendancePageProps) {
    const router = useRouter();
    const { toast } = useToast();
    
    // State for attendance management
    const [attendanceData, setAttendanceData] = useState<{
        cohort: { id: string; name: string };
        totalStudents: number;
        students: any[];
        isEditable: boolean;
    } | null>(null);
    const [studentProgressData, setStudentProgressData] = useState<{
        students: any[];
        totalWorkingDays: number;
        cohortInfo: any;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [progressLoading, setProgressLoading] = useState(true);
    const [updatingStudent, setUpdatingStudent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attendanceDate, setAttendanceDate] = useState<Date>(new Date());
    const [cohortSlug, setCohortSlug] = useState<string>('');

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const resolvedParams = await params;
                const resolvedSearchParams = await searchParams;
                
                setCohortSlug(resolvedParams.cohortSlug);
                setAttendanceDate(getValidAttendanceDate(resolvedSearchParams.date));
                
                await loadAttendanceData(resolvedParams.cohortSlug, getValidAttendanceDate(resolvedSearchParams.date));
                
                // Load student progress data after we have the cohort data
                const cohortResult = await getCohortForAttendance(resolvedParams.cohortSlug);
                if (cohortResult.success) {
                    await loadStudentProgressData(cohortResult.data.cohort.id);
                }
            } catch (err) {
                setError('Failed to load page parameters');
                console.error('Error loading page parameters:', err);
            }
        };
        
        loadData();
    }, [params, searchParams]);

    const loadAttendanceData = async (slug: string, date: Date) => {
        try {
            setLoading(true);
            setError(null);

            // Fetch cohort data and attendance data in parallel
            const [cohortResult, attendanceResult] = await Promise.all([
                getCohortForAttendance(slug),
                getCohortAttendanceForDate(slug, date),
            ]);

            // Handle cohort data errors
            if (!cohortResult.success) {
                setError(typeof cohortResult.error === 'string' ? cohortResult.error : 'Failed to load cohort data');
                return;
            }

            // Handle attendance data errors
            if (!attendanceResult.success) {
                setError(typeof attendanceResult.error === 'string' ? attendanceResult.error : 'Failed to load attendance data');
                return;
            }

            setAttendanceData({
                cohort: cohortResult.data.cohort,
                totalStudents: cohortResult.data.totalStudents,
                students: attendanceResult.data.students,
                isEditable: attendanceResult.data.isEditable,
            });

        } catch (err) {
            setError('Failed to load attendance data');
            console.error('Error loading attendance data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadStudentProgressData = async (cohortId: string) => {
        try {
            setProgressLoading(true);
            const result = await getStudentAttendanceSummary({ cohortId });
            
            if (result.success) {
                setStudentProgressData(result.data);
            } else {
                console.error('Failed to load student progress data:', result.error);
            }
        } catch (err) {
            console.error('Error loading student progress data:', err);
        } finally {
            setProgressLoading(false);
        }
    };

    const handleStatusChange = async (studentId: string, status: AttendanceStatus | null) => {
        if (!attendanceData?.isEditable) {
            toast({
                title: "Read-only Mode",
                description: "Cannot modify attendance for dates older than 30 days.",
                variant: "destructive",
            });
            return;
        }

        try {
            setUpdatingStudent(studentId);

            // Prepare the attendance record for bulkUpdateAttendance
            const result = await bulkUpdateAttendance({
                date: attendanceDate,
                cohortId: attendanceData.cohort.id,
                attendanceRecords: [{
                    studentId,
                    status: status!
                }]
            });

            if (result.success) {
                // Update local state
                setAttendanceData(prev => {
                    if (!prev) return prev;
                    
                    return {
                        ...prev,
                        students: prev.students.map(student => 
                            student.id === studentId 
                                ? { 
                                    ...student, 
                                    attendance: status 
                                            ? { id: 'temp', status } 
                                            : null 
                                  }
                                : student
                        )
                    };
                });

                toast({
                    title: "Attendance Updated",
                    description: `Successfully recorded ${status === 'PRESENT' ? 'present' : 'absence'} for student.`,
                    variant: "default",
                });

                // Refresh the page to get updated data
                router.refresh();

            } else {
                toast({
                    title: "Update Failed",
                    description: typeof result.error === 'string' ? result.error : 'Failed to update attendance',
                    variant: "destructive",
                });
            }

        } catch (err) {
            console.error('Error updating attendance:', err);
            toast({
                title: "Update Failed",
                description: "An unexpected error occurred while updating attendance.",
                variant: "destructive",
            });
        } finally {
            setUpdatingStudent(null);
        }
    };

    const handleDateChange = (newDate: Date) => {
        setAttendanceDate(newDate);
        // Update URL without page refresh
        const formattedDate = format(newDate, 'yyyy-MM-dd');
        router.push(`/attendance/${cohortSlug}?date=${formattedDate}`);
    };

    // Show loading state
    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading attendance data...</p>
                    </div>
                </div>
            </PageContainer>
        );
    }

    // Show error state
    if (error || !attendanceData) {
        return (
            <PageErrorBoundary pageName="Cohort Attendance">
                <PageContainer>
                    <div className="mb-6">
                        <Link href="/attendance">
                            <Button variant="ghost" size="sm" className="mb-4">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Attendance
                            </Button>
                        </Link>
                    </div>
                    <PageHeader
                        title="Error Loading Attendance"
                        description={error || 'Failed to load attendance data'}
                    />
                </PageContainer>
            </PageErrorBoundary>
        );
    }

    const { cohort, totalStudents, students, isEditable } = attendanceData;

    // Calculate statistics for the current date
    const presentCount = students.filter(s => s.attendance?.status === 'PRESENT').length;
    const absentSickCount = students.filter(s => s.attendance?.status === 'ABSENT_SICK').length;
    const absentExcusedCount = students.filter(s => s.attendance?.status === 'ABSENT_EXCUSED').length;
    const absentUnexcusedCount = students.filter(s => s.attendance?.status === 'ABSENT_UNEXCUSED').length;
    const absentCount = absentSickCount + absentExcusedCount + absentUnexcusedCount;
    const unrecordedCount = students.filter(s => !s.attendance).length;

    // Generate date navigation helpers
    const previousWeekday = (() => {
        let prev = subDays(attendanceDate, 1);
        while (isWeekend(prev)) {
            prev = subDays(prev, 1);
        }
        return prev;
    })();

    const nextWeekday = (() => {
        const today = new Date();
        let next = addDays(attendanceDate, 1);
        while (isWeekend(next)) {
            next = addDays(next, 1);
        }
        // Don't allow navigation to future dates
        return next <= today ? next : null;
    })();

    return (
        <PageErrorBoundary pageName="Cohort Attendance">
            <PageContainer>
                {/* Navigation */}
                <div className="mb-6">
                    <Link href="/attendance">
                        <Button variant="ghost" size="sm" className="mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Attendance
                        </Button>
                    </Link>
                </div>

                {/* Page Header */}
                <PageHeader
                    title={`${cohort.name} - Attendance`}
                    description={`Manage daily attendance for ${totalStudents} students`}
                />

                {/* Date Selection and Statistics */}
                <Section>
                    <SectionErrorBoundary sectionName="date and statistics">
                        <div className="flex flex-col lg:flex-row gap-6 mb-8">
                            {/* Date Navigation */}
                            <Card className="lg:w-1/3">
                                <CardHeader>
                                    <CardTitle className="flex items-center text-lg">
                                        <CalendarDays className="h-5 w-5 mr-2" />
                                        Attendance Date:
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold">
                                            {format(attendanceDate, 'EEEE')}
                                        </div>
                                        <div className="text-lg text-muted-foreground">
                                            {format(attendanceDate, 'MMMM d, yyyy')}
                                        </div>
                                        
                                        {!isEditable && (
                                            <Badge variant="secondary" className="mt-2">
                                                <Clock className="h-3 w-3 mr-1" />
                                                Read-only (30+ days old)
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between mb-4">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => handleDateChange(previousWeekday)}
                                        >
                                            ← Previous Day
                                        </Button>

                                        {nextWeekday && (
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => handleDateChange(nextWeekday)}
                                            >
                                                Next Day →
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Statistics */}
                            <div className="lg:w-2/3">
                                <Grid cols="3" className="gap-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Present</CardTitle>
                                            <Users className="h-4 w-4 text-green-600" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
                                            <p className="text-xs text-muted-foreground">
                                                {totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0}% of students
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Absent</CardTitle>
                                            <Users className="h-4 w-4 text-red-600" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
                                            <p className="text-xs text-muted-foreground">
                                                {totalStudents > 0 ? Math.round((absentCount / totalStudents) * 100) : 0}% of students
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Unrecorded</CardTitle>
                                            <Users className="h-4 w-4 text-amber-600" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-amber-600">{unrecordedCount}</div>
                                            <p className="text-xs text-muted-foreground">
                                                Need to record attendance
                                            </p>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </div>
                        </div>
                    </SectionErrorBoundary>
                </Section>

                {/* Student Attendance Table */}
                <Section>
                    <SectionErrorBoundary sectionName="student attendance">
                        <Card>
                            <CardHeader>
                                <CardTitle>Student Attendance</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {isEditable 
                                        ? "Record or update attendance for each student"
                                        : "View historical attendance data (read-only)"
                                    }
                                </p>
                            </CardHeader>
                            <CardContent>
                                {students.length > 0 ? (
                                    <div className="space-y-4">
                                        {students.map((student) => (
                                            <div 
                                                key={student.id}
                                                className="flex items-center justify-between p-4 border rounded-lg"
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                        {student.avatar ? (
                                                            <img 
                                                                src={student.avatar} 
                                                                alt={student.name}
                                                                className="w-10 h-10 rounded-full"
                                                            />
                                                        ) : (
                                                            <span className="text-sm font-medium">
                                                                {student.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{student.name}</div>
                                                        <div className="text-sm text-muted-foreground">{student.email}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <AttendanceStatusDropdown
                                                        studentId={student.id}
                                                        cohortId={cohort.id}
                                                        currentStatus={student.attendance?.status || null}
                                                        date={attendanceDate}
                                                        isEditable={isEditable}
                                                        onStatusChange={handleStatusChange}
                                                        isUpdating={updatingStudent === student.id}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
                                        <p className="text-muted-foreground">
                                            There are no active students in this cohort.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </SectionErrorBoundary>
                </Section>

                {/* Attendance Visualization */}
                <Section>
                    <SectionErrorBoundary sectionName="attendance visualization">
                        <Grid cols="2" gap="lg">
                            <AttendanceStatistics 
                                data={{
                                    present: presentCount,
                                    absentSick: absentSickCount,
                                    absentExcused: absentExcusedCount,
                                    absentUnexcused: absentUnexcusedCount,
                                    unrecorded: unrecordedCount
                                }}
                                totalStudents={totalStudents}
                                date={attendanceDate}
                            />
                            
                            <AttendancePieChart 
                                data={{
                                    present: presentCount,
                                    absentSick: absentSickCount,
                                    absentExcused: absentExcusedCount,
                                    absentUnexcused: absentUnexcusedCount,
                                    unrecorded: unrecordedCount
                                }}
                                totalStudents={totalStudents}
                                date={attendanceDate}
                            />
                        </Grid>
                    </SectionErrorBoundary>
                </Section>

                {/* Individual Student Progress */}
                <Section>
                    <SectionErrorBoundary sectionName="student progress">
                        {progressLoading ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <span className="ml-2">Loading student progress...</span>
                                </CardContent>
                            </Card>
                        ) : studentProgressData ? (
                            <StudentAttendanceProgress
                                students={studentProgressData.students}
                                totalWorkingDays={studentProgressData.totalWorkingDays}
                            />
                        ) : (
                            <Card>
                                <CardContent className="text-center py-8 text-muted-foreground">
                                    <p>Unable to load student progress data</p>
                                </CardContent>
                            </Card>
                        )}
                    </SectionErrorBoundary>
                </Section>
            </PageContainer>
        </PageErrorBoundary>
    );
}
