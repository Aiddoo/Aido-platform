import { useHaptics, useVoiceApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { emitTodoCreated } from '@src/core/events/todo-created';
import { parseErrorFeatureQuota } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { isFreeOfChargeError } from '@src/features/billing/subscription/domains/entitlement.error';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { reflectFeatureQuota } from '@src/features/billing/subscription/queries/entitlement-cache';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { markAiDataSharingConsentRequired } from '@src/features/identity/consent/queries/consent-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { NetworkError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useMutationErrorFeedback } from '@src/shared/query/use-mutation-error-feedback';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions, useQueryClient, onlineManager } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { PLAN_IN_PROGRESS_RETRY } from '../constants/voice.constants';
import type { PreparedPlanRequest } from '../domains/plan-request.model';
import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import type { PlannedAction, VoicePlanSource } from '../domains/voice-plan.model';
import { getVoicePlanFailureCause, isPlanInProgressError } from '../domains/voice.error';
import type { CreateQuickPlanInput } from '../schemas/quick-plan-request.schema';
import { toAnalyticsSource, summarizePlanForAnalytics } from '../utils/voice-analytics';

/** 응답을 놓친 뒤 다시 보냈는데 앞선 요청이 아직 처리 중이면 안내만 하고 끝내지 않고 결과가 나올 때까지 기다린다 */
export const planInProgressRetryOptions = {
  retry: (failureCount: number, error: unknown) =>
    isPlanInProgressError(error) && failureCount < PLAN_IN_PROGRESS_RETRY.maxCount,
  retryDelay: PLAN_IN_PROGRESS_RETRY.delayMs,
} as const;

export interface ApplyActionPlanVariables {
  source: VoicePlanSource;
  sourceMemoId: number | null;
  actions: readonly PlannedAction[];
  fallbackCategoryId: number;
  skippedCount: number;
  idempotencyKey: string;
}

interface ApplyActionPlanMutationOptionsInput {
  /** 저장이 끝났다. `mutate` 콜백과 달리 화면이 내려간 뒤에 응답이 와도 불린다 */
  onSaved?: (saved: { todoCount: number }) => void;
  /** 메모가 생기거나 원본 메모가 사라졌다. 메모 목록을 다시 읽는 일은 메모를 아는 쪽이 맡는다 */
  onMemoChanged: () => void;
}

/** 차감 없이 저장하고 같은 키면 서버가 저장한 결과를 준다. 메모 계획은 성공 때 서버가 원본 메모를 지운다 */
export function useApplyActionPlanMutationOptions({
  onSaved,
  onMemoChanged,
}: ApplyActionPlanMutationOptionsInput) {
  const haptics = useHaptics();
  const voiceApi = useVoiceApi();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const toast = useAppToast();
  const showMutationError = useMutationErrorFeedback();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 고친 카드를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({
      source,
      sourceMemoId,
      actions,
      fallbackCategoryId,
      idempotencyKey,
    }: ApplyActionPlanVariables) =>
      unwrap(
        await voiceApi.applyActionPlan(
          { source, sourceMemoId, actions, fallbackCategoryId },
          idempotencyKey,
        ),
      ),
    onSuccess: ({ todoCount, hasMemo }, { source, sourceMemoId, skippedCount }) => {
      onSaved?.({ todoCount });
      haptics.notify('success');
      emitTodoCreated();
      if (hasMemo || sourceMemoId != null) {
        onMemoChanged();
      }
      toast.success(
        match({ hasTodos: todoCount > 0, hasMemo })
          .with({ hasTodos: true, hasMemo: true }, () =>
            t('voicePlan:applied.todosAndMemo', { count: todoCount }),
          )
          .with({ hasTodos: true }, () => t('voicePlan:applied.todos', { count: todoCount }))
          .otherwise(() => t('voicePlan:applied.memo')),
      );
      trackEvent('voice_plan_applied', {
        source: toAnalyticsSource(source),
        todo_count: todoCount,
        memo_count: hasMemo ? 1 : 0,
        skipped_count: skippedCount,
      });
      // 대시보드를 voice_plan_applied로 옮길 때까지 함께 보낸다
      if (sourceMemoId != null) {
        trackEvent('memo_converted_to_todos', {
          memo_id: sourceMemoId,
          todo_count: todoCount,
          source: 'ai',
        });
      }
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
        if (source === 'memo') {
          trackAttributedFeatureSuccess({ accountId, feature: 'memo_ai' });
        }
        if (source === 'quick-voice') {
          trackAttributedFeatureSuccess({ accountId, feature: 'voice_quick' });
        }
      }
    },
    onError: (error) => {
      const cause = getVoicePlanFailureCause(error);
      if (cause === 'source-memo-missing') {
        onMemoChanged();
      }
      showMutationError(error, {
        feature: 'voice',
        title: t(`voicePlan:failure.${cause}.title`),
        description: t(`voicePlan:failure.${cause}.description`),
      });
    },
    // 응답을 놓친 실패도 서버에는 저장됐을 수 있고, 거절(내 카테고리가 아님)은 카테고리를 다시 받아야 한다.
    // 저장 완료가 다시 받기를 기다리지 않게 돌려주지 않는다
    onSettled: () => {
      invalidateTodos(queryClient);
    },
    meta: { errorFeedback: false },
  });
}

interface CreateQuickPlanVariables extends PreparedPlanRequest<CreateQuickPlanInput> {
  /** 시트를 닫으면 끊는다. 끊어도 키가 같으면 다시 보낼 때 두 번 차감되지 않는다 */
  signal?: AbortSignal;
}

interface CreateQuickPlanMutationOptionsInput {
  onSubscribe?: () => void;
}

export function useCreateQuickPlanMutationOptions({
  onSubscribe,
}: CreateQuickPlanMutationOptionsInput = {}) {
  const voiceApi = useVoiceApi();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const haptics = useHaptics();
  const showMutationError = useMutationErrorFeedback();
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ input, idempotencyKey, signal }: CreateQuickPlanVariables) =>
      unwrap(await voiceApi.createQuickPlan(input, idempotencyKey, signal)),
    onSuccess: ({ plan, featureQuota, isCharged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged: isCharged,
      });
    },
    onError: (error, { input, signal }) => {
      if (signal?.aborted === true) {
        return;
      }
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      const cause = getVoicePlanFailureCause(error);
      trackEvent('voice_plan_failed', {
        source: toAnalyticsSource(input.source),
        cause,
      });
      if (gate.promptIfBlockedError(error, { onSubscribe })) {
        haptics.notify('error');
        return;
      }

      const featureQuota = parseErrorFeatureQuota(error);
      if (featureQuota != null) {
        reflectFeatureQuota(queryClient, featureQuota);
      }
      // 서버가 환불까지 끝냈다고 알린 오류에만 "차감되지 않아요"를 보여 준다
      showMutationError(error, {
        feature: 'voice',
        title: t(`voicePlan:failure.${cause}.title`),
        description: isFreeOfChargeError(error)
          ? `${t(`voicePlan:failure.${cause}.description`)} ${t('subscription:gate.notCharged')}`
          : t(`voicePlan:failure.${cause}.description`),
      });
    },
    meta: { errorFeedback: false },
  });
}

interface CreateVoiceNoteDigestVariables extends PreparedPlanRequest<VoiceNoteDigestInput> {
  /** 화면을 떠나면 끊는다. 키가 기기에 남아 있어 다시 눌러도 두 번 차감되지 않는다 */
  signal?: AbortSignal;
}

export function useCreateVoiceNoteDigestMutationOptions() {
  const voiceApi = useVoiceApi();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const haptics = useHaptics();
  const gate = useEntitlementGate('VOICE_NOTE', { surface: 'voice_note' });

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ input, idempotencyKey, signal }: CreateVoiceNoteDigestVariables) => {
      // 긴 글 정리는 응답 대기 시간이 길어 오프라인이 확실하면 연결 시도를 기다리지 않고 바로 실패시킨다
      if (!onlineManager.isOnline()) {
        throw new NetworkError();
      }
      return unwrap(await voiceApi.createVoiceNoteDigest(input, idempotencyKey, signal));
    },
    onSuccess: ({ plan, featureQuota, isCharged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged: isCharged,
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        trackAttributedFeatureSuccess({ accountId, feature: 'voice_note' });
      }
    },
    onError: (error, { signal }) => {
      if (signal?.aborted === true) {
        return;
      }
      // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
      if (isAiDataSharingConsentRequiredError(error)) {
        markAiDataSharingConsentRequired(queryClient);
        return;
      }

      const cause = getVoicePlanFailureCause(error);
      trackEvent('voice_plan_failed', { source: toAnalyticsSource('voice-note'), cause });
      haptics.notify('error');
      if (gate.promptIfBlockedError(error)) {
        return;
      }

      const featureQuota = parseErrorFeatureQuota(error);
      if (featureQuota != null) {
        reflectFeatureQuota(queryClient, featureQuota);
      }
      // 화면이 실패를 직접 보여 주므로 토스트를 띄우지 않는다. 한 오류는 한 곳에서만 보인다(보고는 정리 훅이 한다)
    },
    meta: { errorFeedback: false },
  });
}
