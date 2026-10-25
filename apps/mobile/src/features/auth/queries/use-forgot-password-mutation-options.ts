import type { ForgotPasswordInput } from '@aido/api';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

export const useForgotPasswordMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ForgotPasswordInput) => {
      const result = await authService.forgotPassword(input);
      return unwrap(result);
    },
    onError: (error) => {
      notifyError();
      toast.error(error, { fallback: t('auth:toasts.requestFailed') });
    },
  });
};
