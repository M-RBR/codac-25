import { AttendanceStatus, Cohort } from '@prisma/client';
import { Users } from 'lucide-react';

import { SectionErrorBoundary } from '@/components/error';
import { Section } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentWithAttendance } from '@/data/attendance/get-cohort-attendance-for-date';

import StudentRow from './student-row';

type StudentAttendanceTableProps = {
    students: StudentWithAttendance[];
    cohort: Cohort;
    attendanceDate: Date;
    isEditable: boolean;
    isSaving: boolean;
    onStatusChange: (studentId: string, status: AttendanceStatus | null) => void;
};

export function StudentAttendanceTable({
    students,
    cohort,
    attendanceDate,
    isEditable,
    isSaving,
    onStatusChange
}: StudentAttendanceTableProps) {

    return (
        <Section>
            <SectionErrorBoundary sectionName="student attendance">
                <Card>
                    <CardHeader>
                        <CardTitle>Student Attendance</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {isEditable
                                ? "Record or update attendance for each student. Changes are saved automatically."
                                : "View historical attendance data (read-only)"
                            }
                            {isSaving && (
                                <span className="ml-2 text-amber-600">
                                    <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-amber-600 mr-1"></span>
                                    Saving changes...
                                </span>
                            )}
                        </p>
                    </CardHeader>
                    <CardContent>
                        {students.length > 0 ? (
                            <div className="space-y-4">
                                {students.map((student) => (
                                    <StudentRow
                                        key={student.id}
                                        student={student}
                                        cohort={cohort}
                                        attendanceDate={attendanceDate}
                                        isEditable={isEditable}
                                        handleStatusChange={onStatusChange}
                                    />
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
    );
}
