import type { PlannedVisibility } from "../../shared/domain/ai-task-outputs.constants.js";
import type { PlanRepeatRef, ScheduleDraft } from "../../shared/domain/todo-draft.constants.js";

/** 정규화한 할 일 계획. schedule은 표현 그대로이고 적용 전에 서버가 날짜·반복으로 바꾼다. */
export interface PlannedTodoDraft {
  readonly title: string;
  readonly categoryId: number | null;
  readonly schedule: ScheduleDraft<PlanRepeatRef>;
  readonly visibility: PlannedVisibility | null;
  readonly items: readonly string[];
  readonly duplicateOfTodoId: number | null;
}

export interface PlannedMemoDraft {
  readonly title: string;
  readonly content: string;
}

const ACTION_PLAN_WARNINGS = [
  "TODOS_TRUNCATED",
  "ITEMS_TRUNCATED",
  "UNKNOWN_CATEGORY",
  "UNKNOWN_DUPLICATE",
  "EMPTY_TITLE",
  "REPEAT_WITH_END_DATE",
] as const;

export type ActionPlanWarning = (typeof ACTION_PLAN_WARNINGS)[number];

export interface NormalizedActionPlan {
  readonly todos: readonly PlannedTodoDraft[];
  readonly memo: PlannedMemoDraft | null;
  /** 할 일 상한을 넘어 버린 할 일 수 */
  readonly omittedTodoCount: number;
  readonly warnings: readonly ActionPlanWarning[];
}

interface NormalizedDigestKeyPoint {
  readonly text: string;
  readonly sentenceIndex: number | null;
}

export interface NormalizedVoiceNoteDigest {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly NormalizedDigestKeyPoint[];
  readonly plan: NormalizedActionPlan;
}
