import { AI_DATA_SHARING_CONSENT, AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { useConsentService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { mutationOptions, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { pick } from 'es-toolkit';

import { type Consent, getConsentResult } from '../domains/consent.model';
import { useConsentResultToast } from '../hooks/use-consent-result-toast';
import { type ConsentAgreement } from '../schemas/consent-request.schema';
import { invalidateConsent } from './consent-cache';
import { CONSENT_MUTATION_KEYS } from './consent-mutation-keys';
import { CONSENT_QUERY_KEYS } from './consent-query-keys';

/** 실패가 섞이면 되돌린 값이 서버와 다를 수 있다. 마지막 저장이 끝날 때 서버 값으로 맞춘다 */
function settleConsentWrite(queryClient: QueryClient, error: unknown) {
  if (error == null || !isLastMutation(queryClient, CONSENT_MUTATION_KEYS.writes())) {
    return;
  }
  invalidateConsent(queryClient);
}

/** 스냅샷을 통째로 덮으면 함께 진행 중인 다른 동의 토글을 지운다. 이 저장이 바꾼 필드만 되돌린다 */
function revertConsentFields(
  queryClient: QueryClient,
  previousData: Consent | undefined,
  fields: readonly (keyof Consent)[],
) {
  if (previousData == null) {
    return;
  }
  queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (consent) =>
    consent == null ? consent : { ...consent, ...pick(previousData, fields) },
  );
}

const AI_DATA_SHARING_FIELDS = [
  'aiDataSharingDecision',
  'aiDataSharingAgreedAt',
  'aiDataSharingConsentVersion',
] as const;

/** 앱이 보여 주는 안내는 하나뿐이라 답한 버전은 항상 현재 안내 버전이다 */
export function useUpdateAiDataSharingConsentMutationOptions() {
  const consentService = useConsentService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 시트의 버튼이 돌기만 하고 나중에도 누를 수 없다. 바로 실패해 시트를 그대로 둔다
    networkMode: 'always',
    mutationKey: CONSENT_MUTATION_KEYS.aiDataSharing(),
    mutationFn: async ({ agreed }: ConsentAgreement) => {
      const result = await consentService.updateAiDataSharingConsent({
        agreed,
        version: AI_DATA_SHARING_CONSENT.VERSION,
      });
      return unwrap(result);
    },

    onMutate: async ({ agreed }) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
      const previousData = queryClient.getQueryData(CONSENT_QUERY_KEYS.detail());

      queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (consent) =>
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
      if (!isLastMutation(queryClient, CONSENT_MUTATION_KEYS.aiDataSharing())) {
        return;
      }
      queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (consent) =>
        consent == null ? consent : { ...consent, ...result },
      );
    },

    onError: (_error, _input, context) => {
      revertConsentFields(queryClient, context?.previousData, AI_DATA_SHARING_FIELDS);
    },

    onSettled: (_data, error) => {
      settleConsentWrite(queryClient, error);
    },
    meta: { errorFeedback: { feature: 'ai', fallbackKey: 'ai:consent.saveFailed' } },
  });
}

export function useUpdateMarketingConsentMutationOptions() {
  const showConsentResult = useConsentResultToast();
  const consentService = useConsentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에 멈춰 있으면 낙관적으로 바꾼 토글이 잠긴 채 남는다. 바로 실패해 되돌린다
    networkMode: 'always',
    mutationKey: CONSENT_MUTATION_KEYS.marketing(),
    mutationFn: async (input: ConsentAgreement) =>
      unwrap(await consentService.updateMarketingConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
      const previousData = queryClient.getQueryData(CONSENT_QUERY_KEYS.detail());
      queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (old) =>
        old == null ? old : { ...old, marketingAgreedAt: input.agreed ? getNowInstant() : null },
      );
      return { previousData };
    },
    onSuccess: (data) => {
      const result = getConsentResult({
        agreedAt: data.marketingAgreedAt,
        withdrawnAt: data.marketingWithdrawnAt,
      });
      if (result != null) {
        showConsentResult('marketing', result);
      }
      if (!isLastMutation(queryClient, CONSENT_MUTATION_KEYS.marketing())) {
        return;
      }
      queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (old) =>
        old == null ? old : { ...old, marketingAgreedAt: data.marketingAgreedAt },
      );
    },

    onError: (_error, _input, context) => {
      revertConsentFields(queryClient, context?.previousData, ['marketingAgreedAt']);
    },

    onSettled: (_data, error) => {
      settleConsentWrite(queryClient, error);
    },
    meta: { errorFeedback: { feature: 'user', fallbackKey: 'auth:toasts.settingsChangeFailed' } },
  });
}

export function useUpdateMarketingPushConsentMutationOptions() {
  const showConsentResult = useConsentResultToast();
  const consentService = useConsentService();
  const queryClient = useQueryClient();

  return mutationOptions({
    networkMode: 'always',
    mutationKey: CONSENT_MUTATION_KEYS.marketingPush(),
    mutationFn: async (input: ConsentAgreement) =>
      unwrap(await consentService.updateMarketingPushConsent(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
      const previousData = queryClient.getQueryData(CONSENT_QUERY_KEYS.detail());
      queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (old) =>
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
      const result = getConsentResult({
        agreedAt: data.marketingPushAgreedAt,
        withdrawnAt: data.marketingPushWithdrawnAt,
      });
      if (result != null) {
        showConsentResult('marketingPush', result);
      }
      if (!isLastMutation(queryClient, CONSENT_MUTATION_KEYS.marketingPush())) {
        return;
      }
      queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (old) =>
        old == null ? old : { ...old, marketingPushAgreedAt: data.marketingPushAgreedAt },
      );
    },
    onError: (_error, _input, context) => {
      revertConsentFields(queryClient, context?.previousData, ['marketingPushAgreedAt']);
    },
    onSettled: (_data, error) => {
      settleConsentWrite(queryClient, error);
    },
    meta: { errorFeedback: { feature: 'user', fallbackKey: 'auth:toasts.settingsChangeFailed' } },
  });
}
