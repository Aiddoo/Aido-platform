import type * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

export function useColdStartNotificationResponse({
  response,
  processResponse,
}: {
  response: Notifications.NotificationResponse | null | undefined;
  processResponse: (response: Notifications.NotificationResponse) => void;
}) {
  useEffect(() => {
    if (!response) {
      return;
    }

    processResponse(response);
  }, [processResponse, response]);
}
