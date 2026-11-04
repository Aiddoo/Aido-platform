import {
  useActivationService,
  useHaptics,
  useVoiceService,
} from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { MEMO_QUERY_KEYS } from '@src/features/memo/constants/memo-query-keys';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/todo/constants/todo-category-query-keys';
import { invalidateTodos } from '@src/features/todo/queries/todo-cache';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { PlannedAction, VoicePlanSource } from '../domains/voice-plan.model';
import { getVoicePlanFailureCause } from '../domains/voice.error';
import { toAnalyticsSource } from '../utils/analytics/voice-plan-analytics';

export interface ApplyActionPlanParams {
  source: VoicePlanSource;
  sourceMemoId: number | null;
  /** 사용자가 고른 행동만 */
  actions: readonly PlannedAction[];
  /** 카테고리를 고르지 못한 할 일에 넣을, 시트의 현재 카테고리 */
  fallbackCategoryId: number;
  /** 고르지 않은 행동 수(분석용) */
  skippedCount: number;
  idempotencyKey: string;
}

/**
 * 확인한 행동을 저장한다. 횟수는 차감하지 않고, 같은 키로 다시 보내면 서버가 저장한 결과를 돌려준다.
 * 메모에서 만든 계획은 저장에 성공하면 서버가 원본 메모를 지운다. 메모 목록과 개수 한도를 다시 읽고,
 * 화면이 떠나는 중이라 상세 캐시는 건드리지 않는다(예전 메모 변환과 같다).
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
      haptics.notify('success');
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      invalidateTodos(queryClient);
      if (hasMemo || sourceMemoId != null) {
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
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
      if (cause === 'rejected') {
        queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all });
      }
      if (cause === 'source-memo-missing') {
        queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
      }
      toast.error(t(`voicePlan:failure.${cause}.title`), {
        description: t(`voicePlan:failure.${cause}.description`),
      });
    },
  });
};
