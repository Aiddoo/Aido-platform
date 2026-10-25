import type { VerifyEmailInput } from '@aido/api';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

export const useVerifyEmailMutationOptions = () => {
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
      notifyError();

      toast.error(error, { fallback: t('auth:toasts.codeInvalidFormal') });
    },
  });
};
