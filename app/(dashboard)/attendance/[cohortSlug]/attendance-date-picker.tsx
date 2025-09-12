import { format } from "date-fns"
import { Section, CalendarDays, Clock, CalendarIcon, Users } from "lucide-react"
import { useState } from "react"

import { SectionErrorBoundary } from "@/components/error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

interface StatisticSectionProps {
    attendanceDate: Date;
    isEditable: boolean;
    handleDateChange: (date: Date) => void;
    handleCalendarDateSelect: (date: Date) => void;
    isDateDisabled: boolean;
    nextWeekday: Date | null;
    previousWeekday: Date | null;
}

export default function AttendanceDatePicker({
    attendanceDate, isEditable, handleDateChange, handleCalendarDateSelect, isDateDisabled, nextWeekday, previousWeekday }: StatisticSectionProps) {
    // State for calendar popover
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    return (
        < Section >
            <SectionErrorBoundary sectionName="date and statistics">
                <div className="flex flex-col lg:flex-row gap-6 mb-8">
                    {/* Date Navigation */}
                    <Card className="lg:w-1/3">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-center text-lg">
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

                            <div className="flex items-center justify-center space-x-2 p-5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDateChange(previousWeekday)}
                                >
                                    ← Previous Day
                                </Button>

                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="px-3"
                                            title="Pick a date"
                                        >
                                            <CalendarIcon className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="center">
                                        <Calendar
                                            mode="single"
                                            selected={attendanceDate}
                                            onSelect={handleCalendarDateSelect}
                                            disabled={isDateDisabled}
                                            initialFocus
                                            fromYear={2020}
                                            toYear={new Date().getFullYear()}
                                        />
                                    </PopoverContent>
                                </Popover>

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


                </div>
            </SectionErrorBoundary>
        </Section >
    );
}