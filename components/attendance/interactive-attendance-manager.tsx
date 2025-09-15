'use client';

import { AttendanceStatus, Cohort } from '@prisma/client';
import { format } from 'date-fns';
import { useCallback, useState, useEffect } from 'react';

import { createAttendance } from '@/actions/attendance/create-attendance';
import { updateAttendance } from '@/actions/attendance/update-attendance';
import { StudentAttendanceTable } from '@/components/attendance/student-attendance-table';
import { type StudentWithAttendance } from '@/data/attendance/get-cohort-attendance-for-date';
import { useToast } from '@/hooks/use-toast';
import { type UpdateAttendanceInput } from '@/lib/validation/attendance';

type CreateAttendanceData = {
    date: string;
    status: AttendanceStatus;
    studentId: string;
    cohortId: string;
};

type InteractiveAttendanceManagerProps = {
    students: StudentWithAttendance[];
    cohort: Cohort;
    attendanceDate: Date;
    isEditable: boolean;
    onProgressUpdate?: () => void;
};

type StudentLoadingState = Record<string, boolean>;

type OptimisticUpdate = {
    studentId: string;
    previousAttendance: StudentWithAttendance['attendance'];
    newStatus: AttendanceStatus | null;
};

export function InteractiveAttendanceManager({
    students,
    cohort,
    attendanceDate,
    isEditable,
    onProgressUpdate
}: InteractiveAttendanceManagerProps) {
    const { toast } = useToast();
    const [localStudents, setLocalStudents] = useState(students);
    const [studentLoadingStates, setStudentLoadingStates] = useState<StudentLoadingState>({});

    // added useEffect to ensure update sync state with server data when navigating between dates with buttons
    useEffect(() => {
        setLocalStudents(students);
    }, [students]);

    const isStudentLoading = useCallback((studentId: string): boolean => {
        return studentLoadingStates[studentId] ?? false;
    }, [studentLoadingStates]);

    const setStudentLoading = useCallback((studentId: string, isLoading: boolean) => {
        setStudentLoadingStates(prev => ({
            ...prev,
            [studentId]: isLoading
        }));
    }, []);

    const applyOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
        setLocalStudents(prev =>
            prev.map(student =>
                student.id === update.studentId
                    ? {
                        ...student,
                        attendance: update.newStatus
                            ? { id: 'optimistic', status: update.newStatus }
                            : null
                    }
                    : student
            )
        );
    }, []);

    const revertOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
        setLocalStudents(prev =>
            prev.map(student =>
                student.id === update.studentId
                    ? { ...student, attendance: update.previousAttendance }
                    : student
            )
        );
    }, []);

    const commitOptimisticUpdate = useCallback((studentId: string, attendanceId: string, status: AttendanceStatus) => {
        setLocalStudents(prev =>
            prev.map(student =>
                student.id === studentId
                    ? {
                        ...student,
                        attendance: { id: attendanceId, status }
                    }
                    : student
            )
        );
    }, []);

    const handleCreateAttendance = useCallback(async (
        studentId: string,
        status: AttendanceStatus,
        optimisticUpdate: OptimisticUpdate
    ) => {
        const createData: CreateAttendanceData = {
            date: format(attendanceDate, 'yyyy-MM-dd'),
            status,
            studentId,
            cohortId: cohort.id
        };
        const result = await createAttendance(createData);
        if (result.success) {
            commitOptimisticUpdate(studentId, result.data.id, status);
            toast({
                title: "Attendance Recorded",
                description: `Successfully recorded ${status.toLowerCase().replace('_', ' ')} for student.`,
                variant: "default",
            });
        } else {
            revertOptimisticUpdate(optimisticUpdate);
            toast({
                title: "Failed to Record",
                description: typeof result.error === 'string' ? result.error : 'Failed to record attendance',
                variant: "destructive",
            });
        }

        return result.success;
    }, [attendanceDate, cohort.id, toast, commitOptimisticUpdate, revertOptimisticUpdate]);

    const handleUpdateAttendance = useCallback(async (
        attendanceId: string,
        studentId: string,
        status: AttendanceStatus,
        optimisticUpdate: OptimisticUpdate
    ) => {
        const updateData: UpdateAttendanceInput = {
            id: attendanceId,
            status
        };

        const result = await updateAttendance(updateData);

        if (result.success) {
            commitOptimisticUpdate(studentId, attendanceId, status);
            toast({
                title: "Attendance Updated",
                description: `Successfully updated to ${status.toLowerCase().replace('_', ' ')}.`,
                variant: "default",
            });
        } else {
            revertOptimisticUpdate(optimisticUpdate);
            toast({
                title: "Failed to Update",
                description: typeof result.error === 'string' ? result.error : 'Failed to update attendance',
                variant: "destructive",
            });
        }

        return result.success;
    }, [toast, commitOptimisticUpdate, revertOptimisticUpdate]);

    const handleStatusChange = useCallback(async (studentId: string, status: AttendanceStatus | null) => {
        if (!isEditable) {
            toast({
                title: "Read-only Mode",
                description: "Cannot modify attendance for dates older than 30 days.",
                variant: "destructive",
            });
            return;
        }

        if (isStudentLoading(studentId)) {
            return; // Prevent concurrent updates for the same student
        }

        const student = localStudents.find(s => s.id === studentId);
        if (!student) return;

        const optimisticUpdate: OptimisticUpdate = {
            studentId,
            previousAttendance: student.attendance,
            newStatus: status
        };

        try {
            setStudentLoading(studentId, true);

            // Apply optimistic update immediately
            applyOptimisticUpdate(optimisticUpdate);

            let success = false;

            if (status === null) {
                // Handle deletion - this would need a separate delete action
                // For now, we'll show an error as deletion isn't implemented
                toast({
                    title: "Not Implemented",
                    description: "Attendance deletion is not yet implemented.",
                    variant: "destructive",
                });
                revertOptimisticUpdate(optimisticUpdate);
                return;
            }

            if (student.attendance?.id) {
                // Update existing attendance
                success = await handleUpdateAttendance(
                    student.attendance.id,
                    studentId,
                    status,
                    optimisticUpdate
                );
            } else {
                // Create new attendance
                success = await handleCreateAttendance(
                    studentId,
                    status,
                    optimisticUpdate
                );
            }

            // Trigger progress data refresh if successful
            if (success && onProgressUpdate) {
                onProgressUpdate();
            }

        } catch (error) {
            console.error('Error handling attendance change:', error);
            revertOptimisticUpdate(optimisticUpdate);
            toast({
                title: "Unexpected Error",
                description: "An unexpected error occurred while saving attendance.",
                variant: "destructive",
            });
        } finally {
            setStudentLoading(studentId, false);
        }
    }, [
        isEditable,
        localStudents,
        isStudentLoading,
        setStudentLoading,
        applyOptimisticUpdate,
        handleCreateAttendance,
        handleUpdateAttendance,
        revertOptimisticUpdate,
        onProgressUpdate,
        toast
    ]);

    return (
        <StudentAttendanceTable
            students={localStudents}
            cohort={cohort}
            attendanceDate={attendanceDate}
            isEditable={isEditable}
            isSaving={Object.values(studentLoadingStates).some(Boolean)} // Any student loading
            onStatusChange={handleStatusChange}
        />
    );
}
