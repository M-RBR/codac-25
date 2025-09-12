import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout';

interface AttendancePageHeaderProps {
    cohortName: string;
    totalStudents: number;
}

export function AttendancePageHeader({ cohortName, totalStudents }: AttendancePageHeaderProps) {
    return (
        <>
            {/* Navigation */}
            <div className="mb-6">
                <Link href="/attendance">
                    <Button variant="ghost" size="sm" className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Main Attendance Page
                    </Button>
                </Link>
            </div>

            {/* Page Header */}
            <PageHeader
                title={`${cohortName} - Attendance`}
                description={`Manage daily attendance for ${totalStudents} students`}
            />
        </>
    );
}
