import { ErrorCode } from '@aido/errors';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export const useEmailLoginMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await authService.emailLogin(email, password);
      return unwrap(result);
    },
    onSuccess: (data) => {
      setStatus('authenticated');
      if (data.accountRestored) {
        toast.success('탈퇴한 계정이 복구되었어요');
      }
    },
    onError: (error, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503)) {
        router.push({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
        return;
      }

      toast.error(error, { fallback: '로그인에 실패했어요' });
    },
  });
};
