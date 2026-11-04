import {
  useActivationService,
  useHaptics,
  useVoiceService,
} from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { MEMO_QUERY_KEYS } from '@src/features/memo/constants/memo-query-keys';
import { invalidateTodos } from '@src/features/todo/queries/todo-cache';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { PlannedAction, VoicePlanSource } from '../domains/voice-plan.model';
import { isTodoAction } from '../domains/voice-plan.model';
import { isPlanKeyExpiredError } from '../domains/voice.error';
import { getVoicePlanFailureCause } from '../domains/voice.error';
import { toAnalyticsSource } from '../utils/analytics/voice-plan-analytics';

export interface ApplyActionPlanParams {
  source: VoicePlanSource;
  /** 사용자가 고른 행동만 */
  actions: readonly PlannedAction[];
  /** 카테고리를 고르지 못한 할 일에 넣을, 시트의 현재 카테고리 */
  fallbackCategoryId: number;
  /** 고르지 않은 행동 수(분석용) */
  skippedCount: number;
  idempotencyKey: string;
}

/**
 * 확인한 행동을 저장한다. 횟수는 차감하지 않는다.
 * AI_1317은 이미 저장했지만 되돌려줄 결과가 남아 있지 않다는 뜻이라 같은 행동을 다시 보내지 않고 저장한 것으로 본다.
 */
export const useApplyActionPlanMutationOptions = () => {
  const haptics = useHaptics();
  const voiceService = useVoiceService();
  const activationService = useActivationService();
  const queryClient = useQueryClient();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({
      source,
      actions,
      fallbackCategoryId,
      idempotencyKey,
    }: ApplyActionPlanParams) => {
      const result = await voiceService.applyActionPlan(
        { source, actions, fallbackCategoryId },
        idempotencyKey,
      );
      if (!result.ok && isPlanKeyExpiredError(result.error)) {
        return {
          todoCount: actions.filter(isTodoAction).length,
          hasMemo: actions.some((action) => !isTodoAction(action)),
        };
      }
      return unwrap(result);
    },
    onSuccess: ({ todoCount, hasMemo }, { source, skippedCount }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      invalidateTodos(queryClient);
      if (hasMemo) {
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.all });
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
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
        if (source === 'memo') {
          trackAttributedFeatureSuccess({ accountId, feature: 'memo_ai' });
        }
      }
    },
    onError: (error) => {
      haptics.notify('error');
      const cause = getVoicePlanFailureCause(error);
      toast.error(t(`voicePlan:failure.${cause}.title`), {
        description: t(`voicePlan:failure.${cause}.description`),
      });
    },
  });
};
