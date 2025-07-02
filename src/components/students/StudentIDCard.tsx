
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
          {/* Base SVG Design with error handling */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-blue-500">
            <img 
              src="/Green Blue Modern Student ID Card.svg" 
              alt="Student ID Card Front Design"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.log('SVG failed to load, using fallback background');
                e.currentTarget.style.display = 'none';
              }}
            />
            
            {/* Fallback design overlay */}
            <div className="absolute inset-0 flex items-start justify-start p-4">
              <div className="text-white font-bold text-lg">
                Spring of Knowledge Academy
              </div>
            </div>
          </div>

          {/* Student Photo - Moved to right-[35px] */}
          <div className="absolute top-[65px] right-[35px] z-20">
            <div className="w-[120px] h-[120px] rounded-full overflow-hidden bg-white border-2 border-white shadow-lg">
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

          {/* Student Information - Moved to top-[145px] */}
          <div className="absolute top-[145px] left-[140px] z-20 space-y-2 max-w-[140px]">
            {/* ID Number field */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              ID: {student.student_id}
            </div>
            
            {/* Full Name field */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              Name: {student.first_name} {student.last_name} {student.father_name || ''}
            </div>
            
            {/* Grade Level field */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              Grade: {formatGradeLevel(student.grade_level)}
            </div>
            
            {/* Emergency Contact field */}
            <div className="text-white font-semibold text-[8px] leading-tight">
              Emergency: {student.emergency_contact_phone || 'N/A'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Side - Using 2.svg as base with error handling */}
      <Card className="w-full h-[250px] relative overflow-hidden">
        <CardContent className="p-0 h-full relative">
          {/* Base SVG Design with fallback */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-green-400">
            <img 
              src="/2.svg" 
              alt="Student ID Card Back Design"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.log('Back SVG failed to load, using fallback background');
                e.currentTarget.style.display = 'none';
              }}
            />
            
            {/* Fallback design for back */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white font-bold text-sm text-center">
                <div>Student ID Card</div>
                <div className="text-xs mt-2">Academic Year: {academicYear}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
