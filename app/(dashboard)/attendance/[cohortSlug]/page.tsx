import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AttendancePageHeader } from '@/components/attendance/attendance-page-header';
import { AttendanceServer } from '@/components/attendance/attendance-server';
import { StudentAttendanceProgress } from '@/components/attendance/student-attendance-progress';
import { PageErrorBoundary, SectionErrorBoundary } from '@/components/error';
import { PageContainer, Section } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { getCohortForAttendance } from '@/data/attendance/get-cohort-for-attendance';
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




export default async function CohortAttendancePage({ params, searchParams }: CohortAttendancePageProps) {
    // Resolve async params
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const { cohortSlug } = resolvedParams;
    const { date: dateParam } = resolvedSearchParams;

    // Get basic cohort info for the page header
    const cohortResult = await getCohortForAttendance(cohortSlug);

    if (!cohortResult.success) {
        notFound();
    }

    const { cohort, totalStudents } = cohortResult.data;

    // Fetch student progress data
    let studentProgressData = null;
    try {
        const progressResult = await getStudentAttendanceSummary({ cohortId: cohort.id });
        if (progressResult.success) {
            studentProgressData = progressResult.data;
        }
    } catch (error) {
        console.error('Error loading student progress data:', error);
    }

    return (
        <PageErrorBoundary pageName="Cohort Attendance">
            <PageContainer>
                {/* Navigation and Header */}
                <AttendancePageHeader
                    cohortName={cohort.name}
                    totalStudents={totalStudents}
                />

                {/* Date Selection, Statistics, Student Attendance Table, and Visualization */}
                <Suspense fallback={
                    <Card>
                        <CardContent className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span className="ml-2">Loading attendance data...</span>
                        </CardContent>
                    </Card>
                }>
                    <AttendanceServer
                        cohortSlug={cohortSlug}
                        dateParam={dateParam}
                        totalStudents={totalStudents}
                    />
                </Suspense>

                {/* Individual Student Progress */}
                <Section>
                    <SectionErrorBoundary sectionName="student progress">
                        <Suspense fallback={
                            <Card>
                                <CardContent className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <span className="ml-2">Loading student progress...</span>
                                </CardContent>
                            </Card>
                        }>
                            {studentProgressData ? (
                                <StudentAttendanceProgress
                                    students={studentProgressData.students.map(student => ({
                                        ...student,
                                        email: student.email || '',
                                        avatar: student.avatar || undefined
                                    }))}
                                    totalWorkingDays={studentProgressData.totalWorkingDays}
                                />
                            ) : (
                                <Card>
                                    <CardContent className="text-center py-8 text-muted-foreground">
                                        <p>Unable to load student progress data</p>
                                    </CardContent>
                                </Card>
                            )}
                        </Suspense>
                    </SectionErrorBoundary>
                </Section>
            </PageContainer>
        </PageErrorBoundary>
    );
}
