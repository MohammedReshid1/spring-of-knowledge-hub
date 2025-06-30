
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, CreditCard } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { IDCardPrinting } from '../students/IDCardPrinting';

export const AccountSettings = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="id-cards" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            ID Card Printing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="id-cards">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Student ID Card Printing
              </CardTitle>
              <CardDescription>
                Generate and print ID cards for students with customizable templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IDCardPrinting />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
