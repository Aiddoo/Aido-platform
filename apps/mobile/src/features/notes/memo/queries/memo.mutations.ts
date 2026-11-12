import {
  useDraftService,
  useHaptics,
  useIdGenerator,
  useMemoApi,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { isFreeOfChargeError } from '@src/features/billing/subscription/domains/entitlement.error';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { reflectFeatureQuota } from '@src/features/billing/subscription/queries/entitlement-cache';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { markAiDataSharingConsentRequired } from '@src/features/identity/consent/queries/consent-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import {
  getVoicePlanFailureCause,
  isPlanKeyConflictError,
} from '@src/features/voice/domains/voice.error';
import { planInProgressRetryOptions } from '@src/features/voice/queries/voice.mutations';
import { createPlanReviewDraft } from '@src/features/voice/utils/plan-review-draft';
import {
  summarizePlanForAnalytics,
  toAnalyticsSource,
} from '@src/features/voice/utils/voice-analytics';
import { useTrack } from '@src/shared/analytics';
import { toEpochMs } from '@src/shared/date/instant';
import type { DraftKey } from '@src/shared/draft/draft.model';
import type { DraftService } from '@src/shared/draft/draft.service';
import { NetworkError } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { t } from '@src/shared/i18n';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';

import { isMemoParseRejectionHandledByFeature } from '../domains/memo.error';
import type { MemoFormValues } from '../schemas/memo-form.schema';
import {
  createMemoCreateRequestDraftKey,
  createMemoDraftKey,
  restoreOrCreateMemoCreateIdempotencyKey,
} from '../utils/memo-draft';
import {
  createMemoPlanDraftKey,
  createMemoPlanRequestDraftKey,
  restoreOrCreateMemoPlanIdempotencyKey,
} from '../utils/memo-plan-draft';
import {
  getCachedMemo,
  invalidateMemo,
  invalidateMemoList,
  invalidateMemoResourceLimit,
  removeMemo,
  settleMemoWrite,
} from './memo-cache';
import { MEMO_MUTATION_KEYS } from './memo-mutation-keys';

export function useCreateMemoMutationOptions() {
  const memoApi = useMemoApi();
  const draftService = useDraftService();
  const idGenerator = useIdGenerator();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    // 시간 초과돼도 서버는 늦게 저장할 수 있어 다시 저장할 때 같은 키를 보낸다. 서버는 그 키로 만든 메모를 돌려준다
    mutationFn: async (values: MemoFormValues) => {
      const accountId = getCachedMe(queryClient)?.id;
      const idempotencyKey =
        accountId == null
          ? idGenerator.create()
          : restoreOrCreateMemoCreateIdempotencyKey(draftService, {
              userId: accountId,
              content: values.content,
              createIdempotencyKey: () => idGenerator.create(),
            });
      return unwrap(await memoApi.createMemo(values, idempotencyKey));
    },
    onSuccess: () => {
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        draftService.remove(createMemoCreateRequestDraftKey({ userId: accountId }));
      }
      trackEvent('memo_created');
    },
    // 기다리면 mutateAsync가 재조회까지 묶여 저장 후 뒤로 가기가 늦어진다. 다른 메모 상세는 그대로다
    onSettled: () => {
      invalidateMemoList(queryClient);
      invalidateMemoResourceLimit(queryClient);
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.retryLater' } },
  });
}

export function useUpdateMemoMutationOptions({ memoId }: { memoId: number }) {
  const memoApi = useMemoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다. 글자는 초안에도 있다
    networkMode: 'always',
    mutationKey: MEMO_MUTATION_KEYS.writes({ memoId }),
    mutationFn: async (values: MemoFormValues) => unwrap(await memoApi.updateMemo(memoId, values)),
    onMutate: () => ({
      startedWithOthers: !isLastMutation(queryClient, MEMO_MUTATION_KEYS.writes({ memoId })),
    }),
    // 돌아간 목록에 옛 글자가 보이지 않게 응답으로 상세와 목록을 바꾼다. 글만 바뀌어 목록 순서는 그대로다
    onSuccess: async (memo, _values, { startedWithOthers }) => {
      await settleMemoWrite(queryClient, memo, { startedWithOthers, isListItemReplaced: true });
      trackEvent('memo_updated', { memo_id: memoId });
    },
    // 응답으로 바꾼 키는 다시 받지 않는다. 기다리면 mutateAsync가 재조회까지 묶여 뒤로 가기가 늦어진다
    onSettled: (_memo, error) => {
      if (error != null) {
        invalidateMemoList(queryClient);
        invalidateMemo(queryClient, { memoId });
      }
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

export function useSetMemoPinnedMutationOptions({ memoId }: { memoId: number }) {
  const memoApi = useMemoApi();
  const draftService = useDraftService();
  const haptics = useHaptics();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const { timeZone } = useDateFormatContext();

  return mutationOptions({
    // 오프라인에 멈춰 두면 버튼이 꺼진 채 남고 연결되는 순간 나도 모르게 실행된다. 바로 실패해 안내한다
    networkMode: 'always',
    mutationKey: MEMO_MUTATION_KEYS.writes({ memoId }),
    onMutate: () => {
      haptics.impact('light');
      return {
        startedWithOthers: !isLastMutation(queryClient, MEMO_MUTATION_KEYS.writes({ memoId })),
      };
    },
    mutationFn: async ({ isPinned }: { isPinned: boolean }) =>
      unwrap(await memoApi.setPinned(memoId, isPinned)),
    onSuccess: async (memo, { isPinned }, { startedWithOthers }) => {
      const previousMemo = getCachedMemo(queryClient, { memoId });
      await settleMemoWrite(queryClient, memo, { startedWithOthers, isListItemReplaced: false });
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
      trackEvent('memo_pin_toggled', { memo_id: memoId, is_pinned: isPinned });
    },
    // 상세는 응답으로 고쳤고 고정 순서만 서버가 정한다
    onSettled: (_memo, error) => {
      invalidateMemoList(queryClient);
      if (error != null) {
        invalidateMemo(queryClient, { memoId });
      }
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.retryLater' } },
  });
}

export function useDeleteMemoMutationOptions() {
  const memoApi = useMemoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에 멈춰 두면 진행 중인 다이얼로그를 닫을 수 없다. 바로 실패해 안내한다
    networkMode: 'always',
    mutationFn: async (memoId: number) => unwrap(await memoApi.deleteMemo(memoId)),
    onSuccess: (_result, memoId) => {
      removeMemo(queryClient, { memoId });
      toast.success(t('memo:toasts.deleted'));
      trackEvent('memo_deleted', { memo_id: memoId });
    },
    // 기다리면 다이얼로그가 목록을 다시 받을 때까지 닫히지 않는다
    onSettled: (_result, error, memoId) => {
      invalidateMemoList(queryClient);
      invalidateMemoResourceLimit(queryClient);
      if (error != null) {
        invalidateMemo(queryClient, { memoId });
      }
    },
    meta: { errorFeedback: { feature: 'memo', fallbackKey: 'memo:toasts.deleteRetry' } },
  });
}

export function useConvertMemoToTodosMutationOptions() {
  const memoApi = useMemoApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 시트와 입력값을 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ memoId, values }: { memoId: number; values: TodoFormValues }) =>
      unwrap(await memoApi.convertToTodos(memoId, values)),
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
  const memoApi = useMemoApi();
  const draftService = useDraftService();
  const idGenerator = useIdGenerator();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'memo_detail' });
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
    const cachedMemo = getCachedMemo(queryClient, { memoId });

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
      return unwrap(await memoApi.parseMemo(content, categoryId, idempotencyKey));
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
      if (gate.promptIfBlockedError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'memo',
        fallbackKey: 'ai:suggestions.toasts.retryLater',
        isHandledByFeature: isMemoParseRejectionHandledByFeature,
        // 서버가 차감하지 않은 실패는 이번 시도가 한도에서 빠지지 않았다고 함께 알린다
        describe: (error) =>
          isFreeOfChargeError(error) ? t('subscription:gate.notCharged') : undefined,
      },
    },
  });
}
