import type { ResendVerificationInput } from '@aido/api';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

export const useResendVerificationMutationOptions = () => {
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
      notifyError();

      toast.error(error, { fallback: t('auth:toasts.codeResendFailed') });
    },
  });
};
