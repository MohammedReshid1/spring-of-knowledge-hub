import React from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useAuth } from '@/hooks/useAuth';
import { useLiveData } from '@/hooks/useLiveData';

/**
 * Notifications Inbox Page
 *
 * A dedicated page for viewing and managing notifications.
 * Shows only the inbox/notification center without any additional features.
 */
const NotificationsPage: React.FC = () => {
  const { user } = useAuth();

  // Enable real-time notifications via WebSocket
  useLiveData(['notifications'], {
    additionalQueryKeys: ['user-notifications']
  });

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <NotificationCenter
        userId={user?.id}
        showHeader={true}
        maxHeight="calc(100vh - 200px)"
        enableSound={true}
      />
    </div>
  );
};

export default NotificationsPage;
