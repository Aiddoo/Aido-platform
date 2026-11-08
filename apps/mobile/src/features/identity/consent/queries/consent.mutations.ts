import { AI_DATA_SHARING_CONSENT, AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { useConsentService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { CONSENT_QUERY_KEYS } from '../constants/consent-query-keys';
import type { Consent, ConsentAgreement } from '../schemas/consent.schema';

/** 앱이 보여 주는 안내는 하나뿐이라 답한 버전은 항상 현재 안내 버전이다 */
export function useUpdateAiDataSharingConsentMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const consentService = useConsentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

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
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.detail());

      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (consent) =>
        consent == null
          ? consent
          : {
              ...consent,
              aiDataSharingDecision: agreed
                ? AI_DATA_SHARING_DECISION.AGREED
                : AI_DATA_SHARING_DECISION.DECLINED,
              aiDataSharingAgreedAt: agreed ? getNowInstant() : null,
              aiDataSharingConsentVersion: AI_DATA_SHARING_CONSENT.VERSION,
            },
      );

      return { previousData };
    },

    onSuccess: (result, { agreed }) => {
      trackEvent('ai_data_sharing_consent_changed', { agreed });
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (consent) =>
        consent == null ? consent : { ...consent, ...result },
      );
    },

    onError: (error, _input, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), context.previousData);
      }
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('ai:consent.saveFailed') });
    },
  });
}

export function useUpdateMarketingConsentMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const consentService = useConsentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 낙관적으로 바꾼 토글이 잠긴 채 남는다. 바로 실패해 되돌린다
    networkMode: 'always',
    mutationFn: async (input: ConsentAgreement) =>
      unwrap(await consentService.updateMarketingConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.detail());
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (old) =>
        old == null ? old : { ...old, marketingAgreedAt: input.agreed ? getNowInstant() : null },
      );
      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (old) =>
        old == null ? old : { ...old, marketingAgreedAt: data.marketingAgreedAt },
      );
    },

    onError: (error, _input, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), context.previousData);
      }
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.settingsChangeFailed') });
    },
  });
}

export function useUpdateMarketingPushConsentMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const consentService = useConsentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ConsentAgreement) =>
      unwrap(await consentService.updateMarketingPushConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
      const previousData = queryClient.getQueryData<Consent>(CONSENT_QUERY_KEYS.detail());
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (old) =>
        old
          ? {
              ...old,
              marketingPushAgreedAt: input.agreed ? getNowInstant() : null,
            }
          : old,
      );
      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (old) =>
        old == null ? old : { ...old, marketingPushAgreedAt: data.marketingPushAgreedAt },
      );
    },
    onError: (error, _input, context) => {
      if (context?.previousData != null) {
        queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), context.previousData);
      }
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.settingsChangeFailed') });
    },
  });
}
