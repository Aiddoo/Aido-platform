import type { ResendVerificationInput } from '@aido/api';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

export const useResendVerificationMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ResendVerificationInput) => {
      const result = await authService.resendVerification(input);
      return unwrap(result);
    },
    onSuccess: () => {
      toast.success(t('auth:toasts.codeResent'));
    },
    onError: (error) => {
      haptics.notify('error');

      toast.error(error, { fallback: t('auth:toasts.codeResendFailed') });
    },
  });
};
