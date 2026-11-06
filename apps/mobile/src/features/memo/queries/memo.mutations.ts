import {
  useActivationService,
  useDraftService,
  useHaptics,
  useIdGenerator,
  useMemoService,
} from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import { markAiDataSharingConsentRequired } from '@src/features/auth/queries/auth-cache';
import { isNotChargedError } from '@src/features/subscription/apis/entitlement.mapper';
import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import type { AddTodoFormValues } from '@src/features/todo/domains/add-todo-form.schema';
import { invalidateTodos } from '@src/features/todo/queries/todo-cache';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { createPlanReviewDraft } from '@src/features/voice/domains/plan-review-form.schema';
import {
  getVoicePlanFailureCause,
  isPlanKeyConflictError,
} from '@src/features/voice/domains/voice.error';
import { planInProgressRetryOptions } from '@src/features/voice/queries/plan-in-progress-retry';
import { reflectFeatureQuota } from '@src/features/voice/queries/voice-plan-cache';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '@src/features/voice/utils/analytics/voice-plan-analytics';
import { useTrack } from '@src/shared/analytics';
import { isApiError, NetworkError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { MEMO_MUTATION_KEYS, MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { MemoFormValues } from '../schemas/memo-form.schema';
import {
  createMemoPlanDraftKey,
  createMemoPlanRequestDraftKey,
  prepareMemoPlanIdempotencyKey,
} from '../utils/memo-plan-draft';
import { invalidateMemos } from './memo-cache';

function useMemoMutationFailure() {
  const haptics = useHaptics();
  const toast = useAppToast();

  return (error: unknown, fallback = t('memo:toasts.retryLater')) => {
    haptics.notify('error');
    match(error)
      .when(isApiError, ({ message }) => toast.error(message))
      .otherwise(() => toast.error(undefined, { fallback }));
  };
}

export function useCreateMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showFailure = useMemoMutationFailure();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationFn: async (values: MemoFormValues) => unwrap(await memoService.createMemo(values)),
    onSuccess: () => trackEvent('memo_created'),
    onError: (error) => showFailure(error),
    // 기다리면 mutateAsync가 재조회까지 묶여 저장 후 뒤로 가기가 늦어진다
    onSettled: () => {
      invalidateMemos(queryClient);
    },
  });
}

export function useUpdateMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showFailure = useMemoMutationFailure();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationFn: async ({ memoId, values }: { memoId: number; values: MemoFormValues }) =>
      unwrap(await memoService.updateMemo(memoId, values)),
    onSuccess: async (memo, { memoId }) => {
      await queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
      queryClient.setQueryData(MEMO_QUERY_KEYS.detail({ memoId }), memo);
      trackEvent('memo_updated', { memo_id: memoId });
    },
    onError: (error) => showFailure(error),
    onSettled: (_memo, _error, { memoId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() }),
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) }),
      ]),
  });
}

export function useToggleMemoPinMutationOptions() {
  const memoService = useMemoService();
  const haptics = useHaptics();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const showFailure = useMemoMutationFailure();

  return mutationOptions({
    onMutate: () => haptics.impact('light'),
    mutationFn: async ({ memoId, isPinned }: { memoId: number; isPinned: boolean }) =>
      unwrap(await memoService.togglePin(memoId, isPinned)),
    onSuccess: async (memo, { memoId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
      queryClient.setQueryData(MEMO_QUERY_KEYS.detail({ memoId }), memo);
      trackEvent('memo_pin_toggled', { memo_id: memoId, is_pinned: isPinned });
    },
    onError: (error) => showFailure(error),
    onSettled: () => invalidateMemos(queryClient),
  });
}

export function useDeleteMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMemoMutationFailure();

  return mutationOptions({
    mutationFn: async (memoId: number) => unwrap(await memoService.deleteMemo(memoId)),
    onSuccess: (_result, memoId) => {
      toast.success(t('memo:toasts.deleted'));
      trackEvent('memo_deleted', { memo_id: memoId });
    },
    onError: (error) => showFailure(error, t('memo:toasts.deleteRetry')),
    // 기다리면 지운 메모의 404 재조회가 먼저 끝나 다이얼로그가 닫히기 전에 경계로 내려갈 수 있다
    onSettled: () => {
      invalidateMemos(queryClient);
    },
  });
}

export function useConvertMemoToTodosMutationOptions() {
  const memoService = useMemoService();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMemoMutationFailure();

  return mutationOptions({
    mutationFn: async ({ memoId, values }: { memoId: number; values: AddTodoFormValues }) =>
      unwrap(await memoService.convertToTodos(memoId, values)),
    onSuccess: (_result, { memoId }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      toast.success(t('memo:toasts.convertedOne'));
      trackEvent('memo_converted_to_todo', { memo_id: memoId });
    },
    onError: (error) => showFailure(error),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
      invalidateTodos(queryClient);
    },
  });
}

interface ParseMemoVariables {
  content: string;
  categoryId: number;
  /** 메모의 수정 시각(epoch ms). 메모가 바뀌면 이 결과는 버려진다 */
  sourceUpdatedAt: number;
}

export function useParseMemoMutationOptions({ memoId }: { memoId: number }) {
  const haptics = useHaptics();
  const memoService = useMemoService();
  const draftService = useDraftService();
  const idGenerator = useIdGenerator();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
  const toast = useAppToast();

  const forgetIdempotencyKey = () => {
    const accountId = getCachedMe(queryClient)?.id;
    if (accountId != null) {
      draftService.remove(createMemoPlanRequestDraftKey({ userId: accountId, memoId }));
    }
  };

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에 멈춰 두면 정리 중 표시가 끝나지 않고, 연결되는 순간 나도 모르게 차감된다. 바로 실패해 안내한다
    networkMode: 'always',
    mutationKey: MEMO_MUTATION_KEYS.parse({ memoId }),
    mutationFn: async ({ content, categoryId, sourceUpdatedAt }: ParseMemoVariables) => {
      if (!onlineManager.isOnline()) {
        throw new NetworkError();
      }
      const accountId = getCachedMe(queryClient)?.id;
      const idempotencyKey =
        accountId == null
          ? idGenerator.create()
          : prepareMemoPlanIdempotencyKey(draftService, {
              userId: accountId,
              memoId,
              content,
              categoryId,
              sourceUpdatedAt,
              createIdempotencyKey: () => idGenerator.create(),
            });
      return unwrap(await memoService.parseMemo(content, categoryId, idempotencyKey));
    },
    onSuccess: ({ plan, featureQuota }, { sourceUpdatedAt }) => {
      forgetIdempotencyKey();
      trackEvent('ai_parse_used', { success: true });
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        draftService.save(
          createMemoPlanDraftKey({ userId: accountId, memoId }),
          createPlanReviewDraft(plan),
          { sourceUpdatedAt },
        );
      }
      // 1.15.0 이전 서버는 응답에 한도를 싣지 않아 다시 묻는다
      reflectFeatureQuota(queryClient, featureQuota);
    },
    onError: (error) => {
      if (isPlanKeyConflictError(error)) {
        forgetIdempotencyKey();
      }
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      trackEvent('ai_parse_used', { success: false });
      trackEvent('voice_plan_failed', { source: 'memo', cause: getVoicePlanFailureCause(error) });
      haptics.notify('error');

      if (gate.handleError(error)) {
        return;
      }

      const description = isNotChargedError(error) ? t('subscription:gate.notCharged') : undefined;
      if (isApiError(error)) {
        toast.error(error.message, { description });
        return;
      }

      toast.error(undefined, { fallback: t('ai:suggestions.toasts.retryLater'), description });
    },
  });
}
