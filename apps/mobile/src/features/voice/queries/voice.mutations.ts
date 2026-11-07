import {
  useActivationService,
  useHaptics,
  useVoiceService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import {
  findErrorFeatureQuota,
  isFreeOfChargeError,
} from '@src/features/billing/subscription/apis/entitlement.mapper';
import type { EntitlementGateSurface } from '@src/features/billing/subscription/constants/subscription.events';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { setFeatureQuota } from '@src/features/billing/subscription/queries/entitlement-cache';
import type { EntitlementFeature } from '@src/features/billing/subscription/schemas/entitlement.schema';
import { recordTodoCreatedForActivation } from '@src/features/device/activation/queries/activation-cache';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { markAiDataSharingConsentRequired } from '@src/features/identity/consent/queries/consent-cache';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { invalidateTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useTrack } from '@src/shared/analytics';
import { NetworkError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient, onlineManager } from '@tanstack/react-query';

import type { PreparedPlanRequest } from '../domains/plan-request.model';
import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import { getVoicePlanFailureCause } from '../domains/voice.error';
import type {
  CreateQuickPlanInput,
  PlannedAction,
  VoicePlanSource,
} from '../schemas/voice-plan.schema';
import { toAnalyticsSource, summarizePlanForAnalytics } from '../utils/voice-analytics';
import { planInProgressRetryOptions } from './plan-in-progress-retry';
import { reflectFeatureQuota } from './voice-plan-cache';

export interface ApplyActionPlanParams {
  source: VoicePlanSource;
  sourceMemoId: number | null;
  actions: readonly PlannedAction[];
  fallbackCategoryId: number;
  skippedCount: number;
  idempotencyKey: string;
}

interface UseApplyActionPlanMutationOptionsParams {
  /** 저장이 끝났다. `mutate` 콜백과 달리 화면이 내려간 뒤에 응답이 와도 불린다 */
  onSaved?: (saved: { todoCount: number }) => void;
  /** 메모가 생기거나 원본 메모가 사라졌다. 메모 목록을 다시 읽는 일은 메모를 아는 쪽이 맡는다 */
  onMemoChanged: () => void;
}

/**
 * 확인한 행동을 저장한다. 횟수는 차감하지 않고, 같은 키로 다시 보내면 서버가 저장한 결과를 돌려준다.
 * 메모에서 만든 계획은 저장에 성공하면 서버가 원본 메모를 지운다. 메모 목록을 다시 읽는 일은
 * `onMemoChanged`로 넘기고, 화면이 떠나는 중이라 상세 캐시는 건드리지 않는다(예전 메모 변환과 같다).
 */
export function useApplyActionPlanMutationOptions({
  onSaved,
  onMemoChanged,
}: UseApplyActionPlanMutationOptionsParams) {
  const haptics = useHaptics();
  const voiceService = useVoiceService();
  const activationService = useActivationService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 고친 카드를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({
      source,
      sourceMemoId,
      actions,
      fallbackCategoryId,
      idempotencyKey,
    }: ApplyActionPlanParams) =>
      unwrap(
        await voiceService.applyActionPlan(
          { source, sourceMemoId, actions, fallbackCategoryId },
          idempotencyKey,
        ),
      ),
    onSuccess: ({ todoCount, hasMemo }, { source, sourceMemoId, skippedCount }) => {
      onSaved?.({ todoCount });
      haptics.notify('success');
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      invalidateTodos(queryClient);
      if (hasMemo || sourceMemoId != null) {
        onMemoChanged();
      }
      toast.success(
        todoCount > 0 && hasMemo
          ? t('voicePlan:applied.todosAndMemo', { count: todoCount })
          : todoCount > 0
            ? t('voicePlan:applied.todos', { count: todoCount })
            : t('voicePlan:applied.memo'),
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
      haptics.notify('error');
      const cause = getVoicePlanFailureCause(error);
      if (cause === 'rejected') {
        invalidateTodoCategories(queryClient);
      }
      if (cause === 'source-memo-missing') {
        onMemoChanged();
      }
      toast.error(t(`voicePlan:failure.${cause}.title`), {
        description: t(`voicePlan:failure.${cause}.description`),
      });
    },
  });
}

interface CreateQuickPlanVariables extends PreparedPlanRequest<CreateQuickPlanInput> {
  /** 시트를 닫으면 끊는다. 끊어도 키가 같으면 다시 보낼 때 두 번 차감되지 않는다 */
  signal?: AbortSignal;
}

interface UseCreateQuickPlanMutationOptionsParams {
  onSubscribe?: () => void;
}

export function useCreateQuickPlanMutationOptions({
  onSubscribe,
}: UseCreateQuickPlanMutationOptionsParams = {}) {
  const voiceService = useVoiceService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const handleFailure = usePlanFailureHandler('AI_PARSE', {
    surface: 'add_todo_sheet',
    onSubscribe,
  });

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ input, idempotencyKey, signal }: CreateQuickPlanVariables) =>
      unwrap(await voiceService.createQuickPlan(input, idempotencyKey, signal)),
    onSuccess: ({ plan, featureQuota, charged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged,
      });
    },
    onError: (error, { input, signal }) => {
      if (signal?.aborted === true) {
        return;
      }
      handleFailure(error, input.source === 'voice' ? 'quick-voice' : 'quick-text');
    },
  });
}

interface CreateVoiceNoteDigestVariables extends PreparedPlanRequest<VoiceNoteDigestInput> {
  /** 화면을 떠나면 끊는다. 키가 기기에 남아 있어 다시 눌러도 두 번 차감되지 않는다 */
  signal?: AbortSignal;
}

export function useCreateVoiceNoteDigestMutationOptions() {
  const voiceService = useVoiceService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const handleFailure = usePlanFailureHandler('VOICE_NOTE', {
    surface: 'voice_note',
    showsFailureInline: true,
  });

  return mutationOptions({
    ...planInProgressRetryOptions,
    // 오프라인에도 멈춰 기다리지 않고 바로 실패해 글자를 남긴 채 안내한다
    networkMode: 'always',
    mutationFn: async ({ input, idempotencyKey, signal }: CreateVoiceNoteDigestVariables) => {
      if (!onlineManager.isOnline()) {
        throw new NetworkError();
      }
      return unwrap(await voiceService.createVoiceNoteDigest(input, idempotencyKey, signal));
    },
    onSuccess: ({ plan, featureQuota, charged }) => {
      reflectFeatureQuota(queryClient, featureQuota);
      trackEvent('voice_plan_generated', {
        source: toAnalyticsSource(plan.source),
        ...summarizePlanForAnalytics(plan),
        charged,
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
      handleFailure(error, 'voice-note');
    },
  });
}

function usePlanFailureHandler(
  feature: Extract<EntitlementFeature, 'AI_PARSE' | 'VOICE_NOTE'>,
  {
    surface,
    onSubscribe,
    showsFailureInline = false,
  }: {
    surface: EntitlementGateSurface;
    onSubscribe?: () => void;
    /** 화면이 실패를 직접 보여 주면 토스트를 띄우지 않는다. 한 오류는 한 곳에서만 보인다 */
    showsFailureInline?: boolean;
  },
) {
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const gate = useEntitlementGate(feature, { surface });

  return (error: unknown, source: VoicePlanSource) => {
    // 동의 안내는 AI를 요청한 화면이 띄우고, 동의하면 같은 요청을 다시 보낸다
    if (isAiDataSharingConsentRequiredError(error)) {
      markAiDataSharingConsentRequired(queryClient);
      return;
    }

    const cause = getVoicePlanFailureCause(error);
    trackEvent('voice_plan_failed', { source: toAnalyticsSource(source), cause });
    haptics.notify('error');

    if (gate.promptIfBlockedError(error, { onSubscribe })) {
      return;
    }

    const featureQuota = findErrorFeatureQuota(error);
    if (featureQuota != null) {
      setFeatureQuota(queryClient, featureQuota);
    }

    if (showsFailureInline) {
      return;
    }

    // 서버가 환불까지 끝냈다고 알린 오류에만 "차감되지 않아요"를 보여 준다
    toast.error(t(`voicePlan:failure.${cause}.title`), {
      description: isFreeOfChargeError(error)
        ? `${t(`voicePlan:failure.${cause}.description`)} ${t('subscription:gate.notCharged')}`
        : t(`voicePlan:failure.${cause}.description`),
    });
  };
}
