import { Cohort, AttendanceStatus } from "@prisma/client";
import Image from "next/image";

import { StudentWithAttendance } from "@/data/attendance/get-cohort-attendance-for-date";

import { AttendanceStatusDropdown } from "./attendance-status-dropdown";

interface StudentRowProps {
    student: StudentWithAttendance;
    cohort: Cohort;
    attendanceDate: Date;
    isEditable: boolean;
    handleStatusChange: (studentId: string, status: AttendanceStatus | null) => void;
}
export default function StudentRow({ student, cohort, attendanceDate, isEditable, handleStatusChange }: StudentRowProps) {

    return (

        <div
            key={student.id}
            className="flex items-center justify-between p-4 border rounded-lg"
        >
            <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    {student.avatar ? (
                        <Image
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
                    isUpdating={false}
                />
            </div>
        </div>

    );
}