import type { TodoOverview } from '@src/features/planning/todo/domains/todo-overview.model';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const activationProgressSchema = z.object({
  todoCreatedAt: instantSchema.nullable(),
  activatedAt: instantSchema.nullable(),
});
export type ActivationProgress = z.infer<typeof activationProgressSchema>;

/** 서버가 아는 이 계정의 할 일 기록. 체크리스트는 만든 할 일과 끝낸 할 일만 본다 */
export type ActivationTodoRecord = Pick<TodoOverview, 'hasTodo' | 'hasCompletedTodo'>;

interface ActivationChecklistSteps {
  hasCreatedTodo: boolean;
  hasCompletedTodo: boolean;
}

interface ChecklistWindowContext {
  signedUpAt: Instant;
  now: Instant;
}

/** 가입하고 이 기간 동안만 시작 체크리스트를 보이고 활성화를 센다 */
const ACTIVATION_CHECKLIST_WINDOW_MS = 7 * DAY_MS;

/** 서버 캠페인과 상관없이 가입 시각만 본다. 기기 시계가 가입보다 앞서면 창 밖이다 */
export function isInChecklistWindow(signedUpAt: Instant, now: Instant): boolean {
  const elapsedMs = diffMs(now, signedUpAt);
  return 0 <= elapsedMs && elapsedMs < ACTIVATION_CHECKLIST_WINDOW_MS;
}

/** 달력 날짜가 아니라 지난 시간으로 세고, 기기 시계가 가입보다 앞서도 0일이다 */
export function calculateDaysSinceSignup(signedUpAt: Instant, now: Instant): number {
  return Math.max(0, Math.floor(diffMs(now, signedUpAt) / DAY_MS));
}

export const ActivationPolicy = {
  shouldOfferChecklist(
    progress: ActivationProgress,
    { signedUpAt, now }: ChecklistWindowContext,
  ): boolean {
    return progress.activatedAt == null && isInChecklistWindow(signedUpAt, now);
  },

  // 재설치·다른 기기·웹에서 만든 할 일도 세도록 서버 기록과 기기 기록 중 하나라도 있으면 끝이다(서버를 못 읽었으면 기기만 본다)
  getChecklistSteps(
    progress: ActivationProgress,
    todoRecord: ActivationTodoRecord | null,
  ): ActivationChecklistSteps {
    const hasCompletedTodo =
      progress.activatedAt != null || (todoRecord?.hasCompletedTodo ?? false);
    return {
      hasCreatedTodo:
        hasCompletedTodo || progress.todoCreatedAt != null || (todoRecord?.hasTodo ?? false),
      hasCompletedTodo,
    };
  },

  /** 필수 단계(만들기·완료)만 본다. 친구 초대는 선택 단계라 끝내지 않아도 된다 */
  hasFinishedRequiredSteps(
    progress: ActivationProgress,
    todoRecord: ActivationTodoRecord | null,
  ): boolean {
    const steps = this.getChecklistSteps(progress, todoRecord);
    return steps.hasCreatedTodo && steps.hasCompletedTodo;
  },

  withTodoCreated(progress: ActivationProgress, at: Instant): ActivationProgress {
    return progress.todoCreatedAt == null ? { ...progress, todoCreatedAt: at } : progress;
  },

  /** 이 기기에서 할 일을 만든 뒤 처음 끝낸 순간이 활성화다. 계정마다 한 번만 센다 */
  canActivate(progress: ActivationProgress): boolean {
    return progress.todoCreatedAt != null && progress.activatedAt == null;
  },

  withActivated(progress: ActivationProgress, at: Instant): ActivationProgress {
    return { ...progress, activatedAt: at };
  },
};
