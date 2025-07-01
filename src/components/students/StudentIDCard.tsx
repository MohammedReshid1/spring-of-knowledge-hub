
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
      {/* Front Side */}
      <Card className="w-full h-[250px] relative overflow-hidden mb-4">
        <CardContent className="p-0 h-full relative">
          {/* Background with decorative pattern */}
          <div className="absolute inset-0 bg-white"></div>
          
          {/* Top decorative pattern */}
          <div 
            className="absolute top-0 right-0 w-full h-16 opacity-40"
            style={{
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'%3E%3Cpath d='M0 10c5.5 0 10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10v10H0z' fill='%2340E0D0'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: '80px 16px'
            }}
          ></div>

          {/* School Logo */}
          <div className="absolute top-3 left-3">
            <img 
              src="/lovable-uploads/ae9bac39-28d4-4d27-b664-560c04f51389.png" 
              alt="Spring of Knowledge Academy Logo"
              className="w-12 h-12 object-contain"
            />
          </div>

          {/* Student ID Card Title */}
          <div className="absolute top-3 left-16 right-4">
            <h1 className="text-lg font-bold text-blue-900 tracking-wide">STUDENT ID CARD</h1>
          </div>

          {/* Student Photo */}
          <div className="absolute top-12 right-6">
            <div className="w-24 h-24 rounded-full border-4 border-blue-900 overflow-hidden bg-white">
              {student.photo_url ? (
                <img 
                  src={student.photo_url} 
                  alt={`${student.first_name} ${student.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xs">No Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Student Information */}
          <div className="absolute bottom-0 left-0 right-0 bg-teal-400 text-white px-4 py-3">
            <div className="space-y-1 text-white">
              <div className="flex items-center">
                <span className="font-semibold text-sm w-28">ID Number</span>
                <span className="text-sm font-bold">: {student.student_id}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-sm w-28">Full Name</span>
                <span className="text-sm font-bold">: {student.first_name} {student.last_name}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-sm w-28">Grade Level</span>
                <span className="text-sm font-bold">: {formatGradeLevel(student.grade_level)}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-sm w-28">Emergency Contact</span>
                <span className="text-sm font-bold">: {student.emergency_contact_phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Side */}
      <Card className="w-full h-[250px] relative overflow-hidden">
        <CardContent className="p-0 h-full relative">
          {/* Background with decorative pattern */}
          <div className="absolute inset-0 bg-white"></div>
          
          {/* Top decorative pattern */}
          <div 
            className="absolute top-0 left-0 w-full h-16 opacity-40"
            style={{
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20'%3E%3Cpath d='M0 10c5.5 0 10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10c0 5.5 4.5 10 10 10s10-4.5 10-10h10v10H0z' fill='%2340E0D0'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: '80px 16px'
            }}
          ></div>

          {/* School Name */}
          <div className="absolute top-16 left-0 right-0 text-center px-4">
            <h1 className="text-2xl font-bold text-blue-900 tracking-wide leading-tight">
              SPRING OF KNOWLEDGE ACADEMY
            </h1>
          </div>

          {/* Contact Information */}
          <div className="absolute bottom-0 left-0 right-0 bg-teal-400 text-white px-4 py-4">
            <div className="grid grid-cols-2 gap-3 text-white text-xs">
              <div className="flex items-center space-x-2">
                <span>📞</span>
                <span>+123-456-7890</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>🏠</span>
                <span>123 Anywhere St., Any City</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✉️</span>
                <span>hello@reallygreatsite.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>🌐</span>
                <span>www.reallygreatsite.com</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
