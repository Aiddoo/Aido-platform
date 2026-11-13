import type { TodoOverview } from '@src/features/planning/todo/domains/todo.model';
import { DAY_MS } from '@src/shared/constants/time-units';
import { type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { z } from 'zod';

export const activationProgressSchema = z.object({
  todoCreatedAt: instantSchema.nullable(),
  activatedAt: instantSchema.nullable(),
});
export type ActivationProgress = z.infer<typeof activationProgressSchema>;

const activationUserSchema = z.object({ id: z.string(), createdAt: instantSchema });
export type ActivationUser = z.infer<typeof activationUserSchema>;

const activationChecklistStepsSchema = z.object({
  hasCreatedTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
type ActivationChecklistSteps = z.infer<typeof activationChecklistStepsSchema>;

const ACTIVATION_CHECKLIST_WINDOW_MS = 7 * DAY_MS;

function isWithinTimeWindow(createdAt: number, now: number, window: number): boolean {
  const elapsed = now - createdAt;
  return 0 <= elapsed && elapsed < window;
}

function calculateElapsedDays(createdAt: number, now: number): number {
  return Math.max(0, Math.floor((now - createdAt) / DAY_MS));
}

/** 가입하고 7일 동안만 시작 체크리스트를 보이고 활성화를 센다. 서버 캠페인과 상관없이 계정만 본다 */
function isInChecklistWindow(user: ActivationUser, now: Instant): boolean {
  return isWithinTimeWindow(
    toEpochMs(user.createdAt),
    toEpochMs(now),
    ACTIVATION_CHECKLIST_WINDOW_MS,
  );
}

/** 가입 7일 안이고 아직 활성화하지 않았으면 체크리스트를 보인다 */
function shouldOfferChecklist(
  user: ActivationUser,
  { progress, now }: { progress: ActivationProgress; now: Instant },
): boolean {
  return progress.activatedAt == null && isInChecklistWindow(user, now);
}

// 재설치·다른 기기·웹에서 만든 할 일도 세도록 서버 기록과 기기 기록 중 하나라도 있으면 끝이다(서버를 못 읽었으면 기기만 본다)
function getChecklistSteps(
  progress: ActivationProgress,
  todoOverview: Pick<TodoOverview, 'hasTodo' | 'hasCompletedTodo'> | undefined,
): ActivationChecklistSteps {
  const hasCompletedTodo =
    progress.activatedAt != null || (todoOverview?.hasCompletedTodo ?? false);
  return {
    hasCreatedTodo:
      hasCompletedTodo || progress.todoCreatedAt != null || (todoOverview?.hasTodo ?? false),
    hasCompletedTodo,
  };
}

/** 필수 단계(만들기·완료)만 본다. 친구 초대는 선택 단계라 끝내지 않아도 된다 */
function hasFinishedRequiredSteps(steps: ActivationChecklistSteps): boolean {
  return steps.hasCreatedTodo && steps.hasCompletedTodo;
}

function getDaysSinceSignup(user: ActivationUser, now: Instant): number {
  return calculateElapsedDays(toEpochMs(user.createdAt), toEpochMs(now));
}

/** 처음 만든 순간만 남긴다 */
function withTodoCreated(progress: ActivationProgress, at: Instant): ActivationProgress {
  return progress.todoCreatedAt == null ? { ...progress, todoCreatedAt: at } : progress;
}

/** 이 기기에서 할 일을 만든 뒤 처음 끝낸 순간이 활성화다. 계정마다 한 번만 센다 */
function canActivate(progress: ActivationProgress): boolean {
  return progress.todoCreatedAt != null && progress.activatedAt == null;
}

function withActivated(progress: ActivationProgress, at: Instant): ActivationProgress {
  return { ...progress, activatedAt: at };
}

export const ActivationPolicy = {
  isInChecklistWindow,
  getChecklistSteps,
  getDaysSinceSignup,
  shouldOfferChecklist,
  hasFinishedRequiredSteps,
  withTodoCreated,
  canActivate,
  withActivated,
} as const;
