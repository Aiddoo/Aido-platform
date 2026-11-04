import type { VerifyEmailInput } from '@aido/api';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

export const useVerifyEmailMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: VerifyEmailInput) => {
      const result = await authService.verifyEmail(input);
      return unwrap(result);
    },
    onSuccess: () => {
      setStatus('authenticated');
    },
    onError: (error) => {
      haptics.notify('error');

      toast.error(error, { fallback: t('auth:toasts.codeInvalid') });
    },
  });
};
