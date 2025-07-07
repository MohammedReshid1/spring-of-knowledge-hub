import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClassForm } from './ClassForm';

interface ClassFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isEditMode: boolean;
  selectedClass: any;
  teachers: any[];
  gradeLevels: any[];
  refetchClasses: () => void;
}

export const ClassFormDialog = ({
  isOpen,
  onClose,
  isEditMode,
  selectedClass,
  refetchClasses,
}: ClassFormDialogProps) => {
  const handleSuccess = () => {
    refetchClasses();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Class' : 'Add New Class'}
          </DialogTitle>
        </DialogHeader>
        <ClassForm
          classData={selectedClass}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
};