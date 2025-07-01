
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
      {/* Front Side - Using 1.svg as base */}
      <Card className="w-full h-[250px] relative overflow-hidden mb-4">
        <CardContent className="p-0 h-full relative">
          {/* Base SVG Design */}
          <div className="absolute inset-0">
            <img 
              src="/1.svg" 
              alt="Student ID Card Front Design"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Student Photo Overlay */}
          <div className="absolute top-6 right-6 z-10">
            <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-white shadow-md">
              {student.photo_url ? (
                <img 
                  src={student.photo_url} 
                  alt={`${student.first_name} ${student.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xs">Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Information Overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="space-y-1 text-white text-shadow">
              <div className="text-xs font-medium">
                <span className="opacity-90">ID: </span>
                <span className="font-semibold">{student.student_id}</span>
              </div>
              <div className="text-sm font-bold">
                {student.first_name} {student.last_name}
              </div>
              <div className="text-xs">
                <span className="opacity-90">Grade: </span>
                <span>{formatGradeLevel(student.grade_level)}</span>
              </div>
              <div className="text-xs">
                <span className="opacity-90">Emergency: </span>
                <span>{student.emergency_contact_phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Side - Using 2.svg as base */}
      <Card className="w-full h-[250px] relative overflow-hidden">
        <CardContent className="p-0 h-full relative">
          {/* Base SVG Design */}
          <div className="absolute inset-0">
            <img 
              src="/2.svg" 
              alt="Student ID Card Back Design"
              className="w-full h-full object-cover"
            />
          </div>

          {/* School Information Overlay (if needed based on your design) */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="text-center text-white text-shadow">
              <div className="text-sm font-bold mb-2">
                Spring of Knowledge Academy
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>📞 +123-456-7890</div>
                <div>🏠 123 Anywhere St.</div>
                <div>✉️ hello@springacademy.com</div>
                <div>🌐 www.springacademy.com</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
