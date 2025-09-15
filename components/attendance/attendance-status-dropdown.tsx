'use client';

import { useState, useEffect } from 'react';
import { Check, Clock } from 'lucide-react';
import { AttendanceStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface AttendanceStatusOption {
    value: AttendanceStatus;
    label: string;
    shortCode: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

const ATTENDANCE_STATUS_OPTIONS: AttendanceStatusOption[] = [
    {
        value: 'PRESENT',
        label: 'Present',
        shortCode: 'Y',
        description: 'Student is present and participating',
        color: 'text-green-800',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
    },
    {
        value: 'ABSENT_SICK',
        label: 'Sick with Sick Leave',
        shortCode: 'K',
        description: 'Student is absent due to illness with proper documentation',
        color: 'text-blue-800',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
    },
    {
        value: 'ABSENT_EXCUSED',
        label: 'Excused Absence',
        shortCode: 'E',
        description: 'Student is absent with prior approval or valid reason',
        color: 'text-yellow-800',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
    },
    {
        value: 'ABSENT_UNEXCUSED',
        label: 'Unexcused Absence',
        shortCode: 'UE',
        description: 'Student is absent without prior approval or valid reason',
        color: 'text-red-800',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
    },
];

interface AttendanceStatusDropdownProps {
    studentId: string;
    cohortId: string;
    currentStatus: AttendanceStatus | null;
    date: Date;
    isEditable: boolean;
    onStatusChange: (studentId: string, status: AttendanceStatus | null) => void;
    isUpdating?: boolean;
    className?: string;
}

export function AttendanceStatusDropdown({
    studentId,
    currentStatus,
    isEditable,
    onStatusChange,
    isUpdating = false,
    className,
}: AttendanceStatusDropdownProps) {
    const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(currentStatus);

    // Update local state when prop changes
    useEffect(() => {
        setSelectedStatus(currentStatus);
    }, [currentStatus]);

    const handleStatusChange = (newStatus: string) => {
        const status = newStatus === 'null' ? null : (newStatus as AttendanceStatus);
        setSelectedStatus(status);
        onStatusChange(studentId, status);
    };

    const getStatusOption = (status: AttendanceStatus | null) => {
        if (!status) return null;
        return ATTENDANCE_STATUS_OPTIONS.find(option => option.value === status);
    };

    const currentOption = getStatusOption(selectedStatus);

    if (!isEditable) {
        // Read-only display for historical data
        if (!selectedStatus) {
            return (
                <Badge variant="outline" className="bg-gray-50 text-gray-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Not Recorded
                </Badge>
            );
        }

        return (
            <Badge 
                variant="secondary"
                className={cn(
                    'cursor-default',
                    currentOption?.bgColor,
                    currentOption?.color,
                    currentOption?.borderColor
                )}
            >
                {currentOption?.label} ({currentOption?.shortCode})
            </Badge>
        );
    }

    return (
        <TooltipProvider>
            <div className={cn('flex items-center space-x-2', className)}>
                <Select
                    value={selectedStatus || 'null'}
                    onValueChange={handleStatusChange}
                    disabled={isUpdating}
                >
                    <SelectTrigger 
                        className={cn(
                            'w-48',
                            currentOption && 'border-2',
                            currentOption?.borderColor,
                            isUpdating && 'opacity-50 cursor-not-allowed',
                        )}
                    >
                        <SelectValue placeholder="Select status">
                            {currentOption ? (
                                <div className="flex items-center space-x-2">
                                    <Badge 
                                        variant="secondary"
                                        className={cn(
                                            'text-xs',
                                            currentOption.bgColor,
                                            currentOption.color,
                                            currentOption.borderColor
                                        )}
                                    >
                                        {currentOption.shortCode}
                                    </Badge>
                                    <span className="truncate">{currentOption.label}</span>
                                </div>
                            ) : (
                                <span className="text-muted-foreground">Select status</span>
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    
                    <SelectContent>
                        <SelectItem value="null">
                            <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="bg-gray-50 text-gray-600">
                                    —
                                </Badge>
                                <span>Not Recorded</span>
                            </div>
                        </SelectItem>
                        
                        {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center space-x-2 w-full">
                                            <Badge 
                                                variant="secondary"
                                                className={cn(
                                                    'text-xs',
                                                    option.bgColor,
                                                    option.color,
                                                    option.borderColor
                                                )}
                                            >
                                                {option.shortCode}
                                            </Badge>
                                            <span className="truncate">{option.label}</span>
                                            {selectedStatus === option.value && (
                                                <Check className="h-4 w-4 ml-auto text-green-600" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                        <p className="font-medium">{option.label}</p>
                                        <p className="text-sm text-muted-foreground">{option.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {isUpdating && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                )}
                
            </div>
        </TooltipProvider>
    );
}

// Export the status options for use in other components
export { ATTENDANCE_STATUS_OPTIONS };
