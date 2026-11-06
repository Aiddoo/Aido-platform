import type { UpdateMarketingConsentInput } from '@aido/api';
import { useConsentService, useHaptics } from '@src/bootstrap/providers/di-context';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import type { Consent } from '@src/features/identity/consent/domains/consent.model';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const useUpdateMarketingConsentMutationOptions = () => {
  const haptics = useHaptics();
  const consentService = useConsentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (input: UpdateMarketingConsentInput) => {
      const result = await consentService.updateMarketingConsent(input);
      return unwrap(result);
    },

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.consent() });

      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.consent());

      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          marketingAgreedAt: input.agreed ? new Date() : null,
        };
      });

      return { previousData };
    },

    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          marketingAgreedAt: data.marketingAgreedAt,
        };
      });
    },

    onError: (_error, _input, context) => {
      haptics.notify('error');

      if (context?.previousData) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.consent(), context.previousData);
      }
    },
  });
};
