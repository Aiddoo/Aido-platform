import { useForegroundNotificationSync } from './use-foreground-notification-sync';
import { useNotificationResponseHandler } from './use-notification-response-handler';

export function useNotificationHandler({ isAuthenticated }: { isAuthenticated: boolean }) {
  return {
    handleNotificationResponse: useNotificationResponseHandler(),
    handleForegroundNotification: useForegroundNotificationSync({ isAuthenticated }),
  };
}
