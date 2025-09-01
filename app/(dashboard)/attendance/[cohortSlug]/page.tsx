import { redirect } from 'next/navigation';
import { CalendarDays, Users, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format, isWeekend, subDays, addDays } from 'date-fns';

import { PageErrorBoundary, SectionErrorBoundary } from '@/components/error';
import { Grid, PageContainer, PageHeader, Section } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/auth/auth';
import { UserRole } from '@prisma/client';
import { getCohortForAttendance } from '@/data/attendance/get-cohort-for-attendance';
import { getCohortAttendanceForDate } from '@/data/attendance/get-cohort-attendance-for-date';

export const dynamic = 'force-dynamic';

interface CohortAttendancePageProps {
    params: {
        cohortSlug: string;
    };
    searchParams: {
        date?: string;
    };
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

export default async function CohortAttendancePage({ params, searchParams }: CohortAttendancePageProps) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/auth/signin');
    }

    // Check if user has the right role
    if (session.user.role !== UserRole.MENTOR && session.user.role !== UserRole.ADMIN) {
        redirect('/attendance');
    }

    // Get valid attendance date
    const attendanceDate = getValidAttendanceDate(searchParams.date);

    // Fetch cohort data and attendance data in parallel
    const [cohortResult, attendanceResult] = await Promise.all([
        getCohortForAttendance(params.cohortSlug),
        getCohortAttendanceForDate(params.cohortSlug, attendanceDate),
    ]);

    // Handle cohort data errors
    if (!cohortResult.success) {
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
                        title="Cohort Not Found"
                        description={typeof cohortResult.error === 'string' ? cohortResult.error : 'Failed to load cohort data'}
                    />
                </PageContainer>
            </PageErrorBoundary>
        );
    }

    // Handle attendance data errors
    if (!attendanceResult.success) {
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
                        title={cohortResult.data?.cohort.name || 'Cohort Attendance'}
                        description={typeof attendanceResult.error === 'string' ? attendanceResult.error : 'Failed to load attendance data'}
                    />
                </PageContainer>
            </PageErrorBoundary>
        );
    }

    const { cohort, totalStudents, totalWorkingDays } = cohortResult.data;
    const { students, isEditable } = attendanceResult.data;

    // Calculate statistics for the current date
    const presentCount = students.filter(s => s.attendance?.status === 'PRESENT').length;
    const absentCount = students.filter(s => s.attendance && s.attendance.status !== 'PRESENT').length;
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
                description={`Manage daily attendance for ${totalStudents} students • ${totalWorkingDays} total course days`}
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
                                    <div className="text-center"><div className="text-center">
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
                                    
                                    </div>
                                    <div className="flex items-center justify-between mb-4">
                                        <Link 
                                            href={`/attendance/${params.cohortSlug}?date=${format(previousWeekday, 'yyyy-MM-dd')}`}
                                        >
                                            <Button variant="outline" size="sm">
                                                ← Previous Day
                                            </Button>
                                        </Link>

                                        {nextWeekday && (
                                            <Link 
                                                href={`/attendance/${params.cohortSlug}?date=${format(nextWeekday, 'yyyy-MM-dd')}`}
                                            >
                                                <Button variant="outline" size="sm">
                                                    Next Day →
                                                </Button>
                                            </Link>
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
                                                    {student.attendance ? (
                                                        <Badge 
                                                            variant={student.attendance.status === 'PRESENT' ? 'default' : 'secondary'}
                                                            className={
                                                                student.attendance.status === 'PRESENT' 
                                                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                                                    : student.attendance.status === 'ABSENT_SICK'
                                                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                                    : student.attendance.status === 'ABSENT_EXCUSED'
                                                                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                                    : 'bg-red-100 text-red-800 border-red-200'
                                                            }
                                                        >
                                                            {student.attendance.status === 'PRESENT' && 'Present (Y)'}
                                                            {student.attendance.status === 'ABSENT_SICK' && 'Sick (K)'}
                                                            {student.attendance.status === 'ABSENT_EXCUSED' && 'Excused (E)'}
                                                            {student.attendance.status === 'ABSENT_UNEXCUSED' && 'Unexcused (UE)'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                                                            Not Recorded
                                                        </Badge>
                                                    )}

                                                    {isEditable && (
                                                        <Button variant="outline" size="sm">
                                                            {student.attendance ? 'Edit' : 'Record'}
                                                        </Button>
                                                    )}
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

                {/* Placeholder for future visualization components */}
                <Section>
                    <SectionErrorBoundary sectionName="attendance visualization">
                        <Card>
                            <CardHeader>
                                <CardTitle>Attendance Overview</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Visualization components will be added in the next task
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8 text-muted-foreground">
                                    📊 Pie chart and progress bars coming soon...
                                </div>
                            </CardContent>
                        </Card>
                    </SectionErrorBoundary>
                </Section>
            </PageContainer>
        </PageErrorBoundary>
    );
}
