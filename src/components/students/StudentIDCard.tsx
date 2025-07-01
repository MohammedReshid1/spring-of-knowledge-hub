
import { Card, CardContent } from '@/components/ui/card';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  photo_url?: string;
  current_class?: string;
  current_section?: string;
  emergency_contact_phone?: string;
  father_name?: string;
}

interface StudentIDCardProps {
  student: Student;
  academicYear?: string;
}

export const StudentIDCard = ({ 
  student, 
  academicYear = new Date().getFullYear().toString()
}: StudentIDCardProps) => {
  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="w-[400px] h-[600px] relative">
      {/* Front Side - Using Green Blue Modern Student ID Card.svg as base */}
      <Card className="w-full h-[250px] relative overflow-hidden mb-4">
        <CardContent className="p-0 h-full relative">
          {/* Base SVG Design */}
          <div className="absolute inset-0">
            <img 
              src="/Green Blue Modern Student ID Card.svg" 
              alt="Student ID Card Front Design"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Student Photo - Made bigger and moved further down-left */}
          <div className="absolute top-[52px] right-[25px] z-20">
            <div className="w-[105px] h-[105px] rounded-full overflow-hidden bg-white border-2 border-white">
              {student.photo_url ? (
                <img 
                  src={student.photo_url} 
                  alt={`${student.first_name} ${student.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xs font-medium">Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Information - Positioned after the colons in each field, even smaller text */}
          <div className="absolute top-[140px] left-[95px] z-20 space-y-3 max-w-[170px]">
            {/* ID Number field - positioned after the colon */}
            <div className="text-white font-semibold text-[10px]">
              {student.student_id}
            </div>
            
            {/* Full Name field - positioned after the colon */}
            <div className="text-white font-semibold text-[10px]">
              {student.first_name} {student.last_name} {student.father_name || ''}
            </div>
            
            {/* Grade Level field - positioned after the colon */}
            <div className="text-white font-semibold text-[10px]">
              {formatGradeLevel(student.grade_level)}
            </div>
            
            {/* Emergency Contact field - positioned after the colon */}
            <div className="text-white font-semibold text-[10px]">
              {student.emergency_contact_phone || 'N/A'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Side - Using 2.svg as base with no additional content */}
      <Card className="w-full h-[250px] relative overflow-hidden">
        <CardContent className="p-0 h-full relative">
          {/* Base SVG Design - No additional content overlaid */}
          <div className="absolute inset-0">
            <img 
              src="/2.svg" 
              alt="Student ID Card Back Design"
              className="w-full h-full object-cover"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
