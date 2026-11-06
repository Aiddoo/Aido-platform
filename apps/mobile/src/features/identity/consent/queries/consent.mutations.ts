import { AI_DATA_SHARING_CONSENT, AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { useConsentService, useHaptics } from '@src/bootstrap/providers/di-context';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import type {
  Consent,
  ConsentAgreement,
} from '@src/features/identity/consent/schemas/consent.schema';
import { useTrack } from '@src/shared/analytics';
import { toInstant } from '@src/shared/date/instant';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

/** 앱이 보여 주는 안내는 하나뿐이라 답한 버전은 항상 현재 안내 버전이다 */
export const useUpdateAiDataSharingConsentMutationOptions = () => {
  const haptics = useHaptics();
  const consentService = useConsentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 시트의 버튼이 돌기만 하고 나중에도 누를 수 없다. 바로 실패해 시트를 그대로 둔다
    networkMode: 'always',
    mutationFn: async ({ agreed }: ConsentAgreement) => {
      const result = await consentService.updateAiDataSharingConsent({
        agreed,
        version: AI_DATA_SHARING_CONSENT.VERSION,
      });
      return unwrap(result);
    },

    onMutate: async ({ agreed }) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.consent() });
      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.consent());

      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (consent) =>
        consent == null
          ? consent
          : {
              ...consent,
              aiDataSharingDecision: agreed
                ? AI_DATA_SHARING_DECISION.AGREED
                : AI_DATA_SHARING_DECISION.DECLINED,
              aiDataSharingAgreedAt: agreed ? toInstant(new Date().toISOString()) : null,
              aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
            },
      );

      return { previousData };
    },

    onSuccess: (result, { agreed }) => {
      trackEvent('ai_data_sharing_consent_changed', { agreed });
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (consent) =>
        consent == null ? consent : { ...consent, ...result },
      );
    },

    onError: (error, _input, context) => {
      haptics.notify('error');
      if (context?.previousData != null) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.consent(), context.previousData);
      }
      toast.error(isApiError(error) ? error.message : undefined, {
        fallback: t('ai:consent.saveFailed'),
      });
    },
  });
};

export const useUpdateMarketingConsentMutationOptions = () => {
  const haptics = useHaptics();
  const consentService = useConsentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: async (input: ConsentAgreement) => {
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
          marketingAgreedAt: input.agreed ? toInstant(new Date().toISOString()) : null,
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

export const useUpdateMarketingPushConsentMutationOptions = () => {
  const haptics = useHaptics();
  const consentService = useConsentService();
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: async (input: ConsentAgreement) =>
      unwrap(await consentService.updateMarketingPushConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.consent() });
      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.consent());
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (old) =>
        old
          ? {
              ...old,
              marketingPushAgreedAt: input.agreed ? toInstant(new Date().toISOString()) : null,
            }
          : old,
      );
      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (old) =>
        old ? { ...old, marketingPushAgreedAt: data.marketingPushAgreedAt } : old,
      );
    },
    onError: (_error, _input, context) => {
      haptics.notify('error');
      if (context?.previousData) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.consent(), context.previousData);
      }
    },
  });
};
