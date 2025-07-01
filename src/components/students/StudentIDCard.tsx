
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

          {/* Student Photo Overlay - Positioned to replace existing photo */}
          <div className="absolute top-[60px] left-[50px] z-20">
            <div className="w-[100px] h-[100px] rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
              {student.photo_url ? (
                <img 
                  src={student.photo_url} 
                  alt={`${student.first_name} ${student.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-sm font-medium">Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Information Overlay - Positioned in designated text areas */}
          <div className="absolute top-[60px] right-[50px] z-20 text-right">
            <div className="space-y-2 text-black">
              <div className="text-lg font-bold">
                {student.first_name} {student.last_name}
              </div>
              <div className="text-sm font-semibold">
                ID: {student.student_id}
              </div>
              <div className="text-sm">
                Grade: {formatGradeLevel(student.grade_level)}
              </div>
            </div>
          </div>

          {/* Additional Info at Bottom */}
          <div className="absolute bottom-[20px] left-[50px] right-[50px] z-20">
            <div className="text-center text-black">
              <div className="text-xs font-medium">
                Academic Year: {academicYear}
              </div>
              {student.emergency_contact_phone && (
                <div className="text-xs mt-1">
                  Emergency: {student.emergency_contact_phone}
                </div>
              )}
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

          {/* School Information Overlay - Positioned to not overlap with design */}
          <div className="absolute bottom-[30px] left-[30px] right-[30px] z-20">
            <div className="text-center text-black bg-white bg-opacity-80 p-3 rounded-lg">
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
