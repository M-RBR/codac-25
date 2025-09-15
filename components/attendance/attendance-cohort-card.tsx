import { Users, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CohortForAttendance } from '@/data/attendance/get-cohorts-for-attendance';

interface AttendanceCohortCardProps {
    cohort: CohortForAttendance;
    className?: string;
}

export function AttendanceCohortCard({ cohort, className }: AttendanceCohortCardProps) {
    const isActive = cohort.endDate ? new Date(cohort.endDate) > new Date() : true;
    const studentCountText = cohort.activeStudentCount === 1 ? '1 student' : `${cohort.activeStudentCount} students`;

    return (
        <Link href={`/attendance/${cohort.slug}`}>
            <Card className={cn(
                "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] group",
                !isActive && "opacity-75",
                className
            )}>
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                                {cohort.name}
                            </CardTitle>
                            {cohort.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {cohort.description}
                                </p>
                            )}
                        </div>
                        {cohort.avatar && (
                            <div className="ml-4 flex-shrink-0">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                    <span className="text-2xl">🎓</span>
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Student Count */}
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{studentCountText}</span>
                        <Badge 
                            variant={isActive ? "default" : "secondary"}
                            className="ml-auto"
                        >
                            {isActive ? 'Active' : 'Ended'}
                        </Badge>
                    </div>

                    {/* Cohort Duration */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Started {format(new Date(cohort.startDate), 'MMM dd, yyyy')}</span>
                        </div>
                        {cohort.endDate && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                    {isActive ? 'Ends' : 'Ended'} {format(new Date(cohort.endDate), 'MMM dd, yyyy')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Action Hint */}
                    <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            Click to manage attendance →
                        </p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
