import { useMutation } from '@tanstack/react-query';

import { registerPushTokenMutationOptions } from '../queries/register-push-token-mutation-options';

export const useRegisterPushToken = () => {
  const options = registerPushTokenMutationOptions();
  const mutation = useMutation(options);

  return {
    registerPushToken: mutation.mutate,
    registerPushTokenAsync: mutation.mutateAsync,
    isRegistering: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
};
