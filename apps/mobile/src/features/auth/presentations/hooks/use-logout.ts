import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService, useNotificationService } from '@src/bootstrap/providers/di-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for logout mutation
 */
export const useLogout = () => {
  const authService = useAuthService();
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const { setStatus } = useAuth();

  return useMutation({
    mutationFn: async () => {
      // Unregister push token before logout
      try {
        await notificationService.unregisterPushToken();
      } catch (error) {
        // Silently fail - continue with logout
        console.log('[PushNotification] Unregister skipped:', error);
      }

      return authService.logout();
    },
    // API 성공/실패 관계없이 항상 로그아웃 처리
    onSuccess: () => {
      setStatus('unauthenticated');
      queryClient.clear();
    },
  });
};
