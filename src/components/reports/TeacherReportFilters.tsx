import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  academic_year?: string;
}

interface Subject {
  id: string;
  name: string;
}

interface TeacherReportFiltersProps {
  classes: Class[];
  subjects: Subject[];
  selectedClass: string;
  selectedSubject: string;
  dateRange: { from: Date; to: Date };
  onClassChange: (classId: string) => void;
  onSubjectChange: (subjectId: string) => void;
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onClearFilters: () => void;
}

export const TeacherReportFilters: React.FC<TeacherReportFiltersProps> = ({
  classes,
  subjects,
  selectedClass,
  selectedSubject,
  dateRange,
  onClassChange,
  onSubjectChange,
  onDateRangeChange,
  onClearFilters,
}) => {
  const selectedClassObj = classes.find(c => c.id === selectedClass);
  const selectedSubjectObj = subjects.find(s => s.id === selectedSubject);

  const hasActiveFilters = selectedClass || selectedSubject !== 'all';

  return (
    <Card className="border-2 border-blue-100 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Report Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Class Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Class</label>
            <Select value={selectedClass} onValueChange={onClassChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{cls.name}</span>
                      <span className="text-xs text-gray-500">
                        Grade {cls.grade_level}
                        {cls.subject && ` • ${cls.subject}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Subject</label>
            <Select value={selectedSubject} onValueChange={onSubjectChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Date Range</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{ from: dateRange?.from, to: dateRange?.to }}
                  onSelect={(range: any) => {
                    if (range?.from && range?.to) {
                      onDateRangeChange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
            <span className="text-sm text-gray-600">Active filters:</span>
            {selectedClassObj && (
              <Badge variant="secondary" className="gap-1">
                <span className="font-medium">Class:</span>
                <span>{selectedClassObj.name}</span>
                <button
                  onClick={() => onClassChange('')}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedSubject !== 'all' && selectedSubjectObj && (
              <Badge variant="secondary" className="gap-1">
                <span className="font-medium">Subject:</span>
                <span>{selectedSubjectObj.name}</span>
                <button
                  onClick={() => onSubjectChange('all')}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="ml-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              Clear all filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
