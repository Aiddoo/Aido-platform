import { useForegroundNotificationSync } from './use-foreground-notification-sync';
import { useNotificationResponseHandler } from './use-notification-response-handler';

interface UseNotificationHandlerOptions {
  isAuthenticated: boolean;
}

export function useNotificationHandler({ isAuthenticated }: UseNotificationHandlerOptions) {
  return {
    handleNotificationResponse: useNotificationResponseHandler({ isAuthenticated }),
    handleForegroundNotification: useForegroundNotificationSync({ isAuthenticated }),
  };
}
