import type { VerifyEmailInput } from '@aido/api';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

import { useAuthSession } from '../hooks/use-auth-session';

export const useVerifyEmailMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { signIn } = useAuthSession();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: VerifyEmailInput) => {
      const result = await authService.verifyEmail(input);
      return unwrap(result);
    },
    onSuccess: () => {
      signIn();
    },
    onError: (error) => {
      haptics.notify('error');

      toast.error(error, { fallback: t('auth:toasts.codeInvalid') });
    },
  });
};
