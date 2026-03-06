import { ErrorCode } from '@aido/errors';
import type { RegisterInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export const useRegisterMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: RegisterInput) => {
      const result = await authService.register(input);
      return unwrap(result);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0501)) {
        toast.error('이미 가입된 이메일이에요', {
          action: {
            label: '로그인하기',
            onPress: () => {
              router.replace('/(auth)/email-login');
            },
          },
        });
        return;
      }
      toast.error(error, { fallback: '회원가입에 실패했습니다' });
    },
  });
};
