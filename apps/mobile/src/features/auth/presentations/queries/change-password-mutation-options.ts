import { ErrorCode } from '@aido/errors';
import type { ChangePasswordInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export const changePasswordMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();
  const router = useRouter();

  return mutationOptions({
    mutationFn: async (input: ChangePasswordInput) => {
      const result = await authService.changePassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('비밀번호가 변경되었어요');
      router.back();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        if (error.hasCode(ErrorCode.USER_0602)) {
          toast.error('현재 비밀번호가 일치하지 않아요');
          return;
        }

        if (error.hasCode(ErrorCode.USER_0613)) {
          toast.error('소셜 로그인 계정은 비밀번호를 변경할 수 없어요');
          return;
        }
      }

      toast.error(error, { fallback: '비밀번호 변경에 실패했어요' });
    },
  });
};
