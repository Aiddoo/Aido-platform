import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService, useNotificationService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const logoutMutationOptions = () => {
  const authService = useAuthService();
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async () => {
      // Unregister push token before logout
      try {
        const unregisterResult = await notificationService.unregisterPushToken();
        if (!unregisterResult.ok) {
          console.log('[PushNotification] Unregister skipped:', unregisterResult.error);
        }
      } catch (error) {
        // Silently fail - continue with logout
        console.log('[PushNotification] Unregister error:', error);
      }

      const result = await authService.logout();
      if (!result.ok) {
        console.log('[Logout] API failed:', result.error);
      }
    },
    // API 성공/실패 관계없이 항상 로그아웃 처리
    onSettled: () => {
      setStatus('unauthenticated');
      queryClient.clear();
    },
  });
};
