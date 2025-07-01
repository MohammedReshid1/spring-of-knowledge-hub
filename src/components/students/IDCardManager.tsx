
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import { IDCardPrinting } from './IDCardPrinting';

export const IDCardManager = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Student ID Card Printing</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Generate Student ID Cards
          </CardTitle>
          <CardDescription>
            Generate and print ID cards for students with Spring of Knowledge Academy branding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IDCardPrinting />
        </CardContent>
      </Card>
    </div>
  );
};
