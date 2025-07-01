
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const ImportGuide = () => {
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/student-import-template.csv';
    link.download = 'student-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const requiredFields = [
    { field: 'first_name', description: 'Student\'s first name (required)' },
    { field: 'last_name', description: 'Student\'s last name (required)' },
    { field: 'date_of_birth', description: 'Date of birth in YYYY-MM-DD format (required)' },
    { field: 'grade_level', description: 'Grade level: pre_k, kindergarten, grade_1 to grade_12 (required)' },
    { field: 'gender', description: 'Gender: Male or Female (optional)' },
    { field: 'address', description: 'Student\'s address (optional)' },
    { field: 'phone', description: 'Student\'s phone number (optional)' },
    { field: 'email', description: 'Student\'s email address (optional)' },
    { field: 'emergency_contact_name', description: 'Emergency contact person\'s name (optional)' },
    { field: 'emergency_contact_phone', description: 'Emergency contact phone number (optional)' },
    { field: 'father_name', description: 'Father\'s name (optional)' },
    { field: 'mother_name', description: 'Mother\'s name (optional)' },
    { field: 'grandfather_name', description: 'Grandfather\'s name (optional)' },
    { field: 'medical_info', description: 'Any medical information or allergies (optional)' },
    { field: 'previous_school', description: 'Previous school attended (optional)' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Student Import Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            When importing students, the system will automatically generate unique Student IDs 
            in the format SCH-YYYY-00001. You don't need to include student_id in your import file.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Step 1: Download the Template</h3>
            <Button onClick={handleDownloadTemplate} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download CSV Template
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Step 2: Fill in Student Data</h3>
            <p className="text-sm text-gray-600 mb-3">
              Use the downloaded template to enter student information. Required fields are marked below:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {requiredFields.map((field) => (
                <div key={field.field} className="flex items-start gap-2 text-sm">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono min-w-fit">
                    {field.field}
                  </code>
                  <span className="text-gray-600">{field.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Step 3: Upload Your File</h3>
            <p className="text-sm text-gray-600">
              Save your completed file as CSV format and use the import function in the Students page.
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Important Notes:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Date format must be YYYY-MM-DD (e.g., 2010-05-15)</li>
                <li>Grade levels must match exactly: pre_k, kindergarten, grade_1, grade_2, etc.</li>
                <li>All phone numbers should be in Ethiopian format</li>
                <li>Email addresses must be valid format</li>
                <li>The system will validate all data before importing</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};
