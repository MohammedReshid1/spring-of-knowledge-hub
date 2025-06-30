
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  photo_url?: string;
  current_class?: string;
  current_section?: string;
}

interface StudentIDCardProps {
  student: Student;
  schoolName?: string;
  academicYear?: string;
}

export const StudentIDCard = ({ 
  student, 
  schoolName = "Mountain View School",
  academicYear = new Date().getFullYear().toString()
}: StudentIDCardProps) => {
  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className="w-[320px] h-[200px] bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 shadow-lg">
      <CardContent className="p-4 h-full flex">
        {/* Left side - Photo */}
        <div className="flex-shrink-0 mr-4">
          <div className="w-20 h-24 bg-gray-200 rounded border-2 border-gray-300 flex items-center justify-center overflow-hidden">
            {student.photo_url ? (
              <img 
                src={student.photo_url} 
                alt={`${student.first_name} ${student.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-gray-500 text-xs text-center">
                No Photo
              </div>
            )}
          </div>
        </div>

        {/* Right side - Information */}
        <div className="flex-1 flex flex-col justify-between">
          {/* Header */}
          <div className="text-center mb-2">
            <h3 className="text-sm font-bold text-blue-800 leading-tight">
              {schoolName}
            </h3>
            <p className="text-xs text-blue-600">Student ID Card</p>
          </div>

          {/* Student Info */}
          <div className="space-y-1 flex-1">
            <div>
              <p className="text-xs font-semibold text-gray-700">
                {student.first_name} {student.last_name}
              </p>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">ID:</span>
              <span className="text-xs font-mono font-medium">{student.student_id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Grade:</span>
              <Badge variant="outline" className="text-xs py-0 px-1">
                {formatGradeLevel(student.grade_level)}
              </Badge>
            </div>

            {student.current_class && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Class:</span>
                <span className="text-xs">{student.current_class}</span>
              </div>
            )}

            {student.current_section && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Section:</span>
                <span className="text-xs">{student.current_section}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-2 border-t border-blue-200">
            <p className="text-xs text-blue-600">Academic Year {academicYear}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
