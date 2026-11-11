import {
  useDraftService,
  useHaptics,
  useIdGenerator,
  useMemoService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { isFreeOfChargeError } from '@src/features/billing/subscription/domains/entitlement.error';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { markAiDataSharingConsentRequired } from '@src/features/identity/consent/queries/consent-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import type { AddTodoFormValues } from '@src/features/planning/composer/schemas/add-todo-form.schema';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import {
  getVoicePlanFailureCause,
  isPlanKeyConflictError,
} from '@src/features/voice/domains/voice.error';
import { planInProgressRetryOptions } from '@src/features/voice/queries/plan-in-progress-retry';
import { reflectFeatureQuota } from '@src/features/voice/queries/voice-plan-cache';
import { createPlanReviewDraft } from '@src/features/voice/utils/plan-review-draft';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '@src/features/voice/utils/voice-analytics';
import { useTrack } from '@src/shared/analytics';
import { toEpochMs } from '@src/shared/date/instant';
import type { DraftKey } from '@src/shared/draft/draft.model';
import type { DraftService } from '@src/shared/draft/draft.service';
import { getUserFacingMessage, NetworkError } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';

import { MEMO_MUTATION_KEYS } from '../constants/memo-mutation-keys';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { MemoFormValues } from '../schemas/memo-form.schema';
import { createMemoDraftKey } from '../utils/memo-draft';
import {
  createMemoPlanDraftKey,
  createMemoPlanRequestDraftKey,
  restoreOrCreateMemoPlanIdempotencyKey,
} from '../utils/memo-plan-draft';
import { invalidateMemoList, invalidateMemoResourceLimit, replaceMemoInList } from './memo-cache';

export function useCreateMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationFn: async (values: MemoFormValues) => unwrap(await memoService.createMemo(values)),
    onSuccess: () => trackEvent('memo_created'),
    // 기다리면 mutateAsync가 재조회까지 묶여 저장 후 뒤로 가기가 늦어진다. 다른 메모 상세는 그대로다
    onSettled: () => {
      invalidateMemoList(queryClient);
      invalidateMemoResourceLimit(queryClient);
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.retryLater' } },
  });
}

export function useUpdateMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationFn: async ({ memoId, values }: { memoId: number; values: MemoFormValues }) =>
      unwrap(await memoService.updateMemo(memoId, values)),
    onSuccess: async (memo, { memoId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) }),
        queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.list() }),
      ]);
      queryClient.setQueryData(MEMO_QUERY_KEYS.detail({ memoId }), memo);
      // 재조회를 기다리지 않고 떠나므로 돌아간 목록에 옛 글자가 보이지 않게 먼저 바꾼다
      replaceMemoInList(queryClient, memo);
      trackEvent('memo_updated', { memo_id: memoId });
    },
    // 기다리면 mutateAsync가 재조회까지 묶여 저장 후 뒤로 가기가 늦어진다
    onSettled: (_memo, _error, { memoId }) => {
      invalidateMemoList(queryClient);
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.retryLater' } },
  });
}

/** 서버는 고정만 바꿔도 수정 시각을 바꾼다. 같은 내용의 초안이 낡았다고 버려지지 않게 기준 시각을 옮겨 저장한다 */
function rebaseDraftSource<TValue>(
  draftService: Pick<DraftService, 'restore' | 'save'>,
  draftKey: DraftKey<TValue>,
  { from, to }: { from: number; to: number },
) {
  const restored = draftService.restore(draftKey, { sourceUpdatedAt: from });
  if (restored.status === 'restored') {
    draftService.save(draftKey, restored.value, { sourceUpdatedAt: to });
  }
}

export function useSetMemoPinnedMutationOptions() {
  const memoService = useMemoService();
  const draftService = useDraftService();
  const haptics = useHaptics();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const { timeZone } = useDateFormatContext();

  return mutationOptions({
    // 오프라인에 멈춰 두면 버튼이 꺼진 채 남고 연결되는 순간 나도 모르게 실행된다. 바로 실패해 안내한다
    networkMode: 'always',
    onMutate: () => haptics.impact('light'),
    mutationFn: async ({ memoId, isPinned }: { memoId: number; isPinned: boolean }) =>
      unwrap(await memoService.setPinned(memoId, isPinned)),
    onSuccess: async (memo, { memoId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
      const previousMemo = queryClient.getQueryData(MEMO_QUERY_KEYS.detail({ memoId }));
      const accountId = getCachedMe(queryClient)?.id;
      if (previousMemo != null && accountId != null) {
        const source = { from: toEpochMs(previousMemo.updatedAt), to: toEpochMs(memo.updatedAt) };
        rebaseDraftSource(draftService, createMemoDraftKey({ userId: accountId, memoId }), source);
        rebaseDraftSource(
          draftService,
          createMemoPlanDraftKey({ userId: accountId, memoId, timeZone }),
          source,
        );
        rebaseDraftSource(
          draftService,
          createMemoPlanRequestDraftKey({ userId: accountId, memoId }),
          source,
        );
      }
      queryClient.setQueryData(MEMO_QUERY_KEYS.detail({ memoId }), memo);
      trackEvent('memo_pin_toggled', { memo_id: memoId, is_pinned: isPinned });
    },
    // 상세는 응답으로 고쳤고 고정 순서만 서버가 정한다
    onSettled: (_memo, error, { memoId }) => {
      invalidateMemoList(queryClient);
      if (error != null) {
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
      }
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.retryLater' } },
  });
}

export function useDeleteMemoMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 진행 중인 다이얼로그를 닫을 수 없다. 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (memoId: number) => unwrap(await memoService.deleteMemo(memoId)),
    onSuccess: (_result, memoId) => {
      toast.success(t('memo:toasts.deleted'));
      trackEvent('memo_deleted', { memo_id: memoId });
    },
    // 기다리면 지운 메모의 404 재조회가 먼저 끝나 다이얼로그가 닫히기 전에 경계로 내려갈 수 있다
    onSettled: (_result, _error, memoId) => {
      invalidateMemoList(queryClient);
      invalidateMemoResourceLimit(queryClient);
      queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.deleteRetry' } },
  });
}

export function useConvertMemoToTodosMutationOptions() {
  const memoService = useMemoService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 시트와 입력값을 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({
      memoId,
      values,
      timeZone,
    }: {
      memoId: number;
      values: AddTodoFormValues;
      timeZone: string;
    }) => unwrap(await memoService.convertToTodos(memoId, values, timeZone)),
    onSuccess: (_result, { memoId }) => {
      emitTodoCreated();
      toast.success(t('memo:toasts.convertedOne'));
      trackEvent('memo_converted_to_todo', { memo_id: memoId });
    },
    onSettled: () => {
      invalidateMemoList(queryClient);
      invalidateMemoResourceLimit(queryClient);
      invalidateTodos(queryClient);
    },
    meta: { errorFeedback: { feature: 'todo', fallbackKey: 'memo:toasts.retryLater' } },
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
  const { timeZone } = useDateFormatContext();

  const forgetIdempotencyKey = () => {
    const accountId = getCachedMe(queryClient)?.id;
    if (accountId != null) {
      draftService.remove(createMemoPlanRequestDraftKey({ userId: accountId, memoId }));
    }
  };

  // 정리하는 사이 고정하면 글은 같은데 수정 시각만 바뀐다. 옛 시각으로 저장하면 결과를 낡았다고 버려 다시 차감된다
  const getCurrentSourceUpdatedAt = ({
    content,
    sourceUpdatedAt,
  }: Pick<ParseMemoVariables, 'content' | 'sourceUpdatedAt'>) => {
    const cachedMemo = queryClient.getQueryData(MEMO_QUERY_KEYS.detail({ memoId }));

    return cachedMemo?.content === content ? toEpochMs(cachedMemo.updatedAt) : sourceUpdatedAt;
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
          : restoreOrCreateMemoPlanIdempotencyKey(draftService, {
              userId: accountId,
              memoId,
              content,
              categoryId,
              sourceUpdatedAt: getCurrentSourceUpdatedAt({ content, sourceUpdatedAt }),
              createIdempotencyKey: () => idGenerator.create(),
            });
      return unwrap(await memoService.parseMemo(content, categoryId, idempotencyKey));
    },
    onSuccess: ({ plan, featureQuota }, variables) => {
      forgetIdempotencyKey();
      trackEvent('ai_parse_used', { success: true });
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        draftService.save(
          createMemoPlanDraftKey({ userId: accountId, memoId, timeZone }),
          createPlanReviewDraft(plan),
          { sourceUpdatedAt: getCurrentSourceUpdatedAt(variables) },
        );
      }
      // 서버가 한도를 읽지 못해 싣지 않았으면 다시 묻는다
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

      if (gate.promptIfBlockedError(error)) {
        return;
      }

      toast.error(getUserFacingMessage(error), {
        fallback: t('ai:suggestions.toasts.retryLater'),
        description: isFreeOfChargeError(error) ? t('subscription:gate.notCharged') : undefined,
      });
    },
    meta: { errorFeedback: false },
  });
}
