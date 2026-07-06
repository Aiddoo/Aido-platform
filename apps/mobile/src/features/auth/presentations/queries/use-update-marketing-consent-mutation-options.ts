import type { UpdateMarketingConsentInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { Consent } from '../../models/auth.model';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const useUpdateMarketingConsentMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (input: UpdateMarketingConsentInput) => {
      const result = await authService.updateMarketingConsent(input);
      return unwrap(result);
    },

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEYS.consent() });

      const previousData = queryClient.getQueryData<Consent>(AUTH_QUERY_KEYS.consent());

      queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (old) => {
        if (!old) return old;
        return {
          ...old,
          marketingAgreedAt: input.agreed ? new Date() : null,
        };
      });

      return { previousData };
    },

    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (old) => {
        if (!old) return old;
        return {
          ...old,
          marketingAgreedAt: data.marketingAgreedAt,
        };
      });
    },

    onError: (_error, _input, context) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (context?.previousData) {
        queryClient.setQueryData(AUTH_QUERY_KEYS.consent(), context.previousData);
      }
    },
  });
};
