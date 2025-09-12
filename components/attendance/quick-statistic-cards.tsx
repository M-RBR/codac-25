import { Users } from "lucide-react";
import { Grid } from "../layout";
import { Card, CardHeader, CardContent, CardTitle } from "../ui/card";

interface StatisticProps {
    presentCount: number;
    absentCount: number;
    unrecordedCount: number;
    totalStudents: number;
}

export default function Statistic({ presentCount, absentCount, unrecordedCount, totalStudents }: StatisticProps) {
    return (

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
        </div >
    )
}