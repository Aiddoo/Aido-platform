import { ErrorCode } from '@aido/errors';
import type { ResetPasswordInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export const useResetPasswordMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();
  const router = useRouter();

  return mutationOptions({
    mutationFn: async (input: ResetPasswordInput) => {
      const result = await authService.resetPassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('비밀번호가 재설정되었어요');
      router.replace('/(auth)/email-login');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        if (error.hasCode(ErrorCode.VERIFY_0751)) {
          toast.error('인증 코드가 올바르지 않아요');
          return;
        }
        if (error.hasCode(ErrorCode.VERIFY_0752)) {
          toast.error('인증 코드가 만료되었어요. 다시 요청해주세요');
          return;
        }
        if (error.hasCode(ErrorCode.VERIFY_0754)) {
          toast.error('인증 시도 횟수를 초과했어요. 새 인증 코드를 요청해주세요');
          return;
        }
      }

      toast.error(error, { fallback: '비밀번호 재설정에 실패했어요' });
    },
  });
};
