import type { TodoVisibility } from "@aido/api/vocabulary";

import type {
  DateRef,
  PlanRepeatRef,
  ScheduleDraft,
  TimeRef,
} from "../../shared/domain/todo-draft.constants.js";

/**
 * 계획 프롬프트(quick-plan·voice-note-digest)가 내는 표현. 도구 입력에서 유니온 배열이 문자열로 깨져 오는 일이
 * 있어 모델 출력은 할 일 목록과 메모 하나로 나눈다.
 * 일정은 날짜가 아니라 표현(ScheduleDraft)이고, 서버 resolver가 사용자 시간대로 계산한다.
 */
/** 계획은 말로 비공개를 요청했을 때만 공개 범위를 정한다 */
export type PlannedVisibility = Extract<TodoVisibility, "PRIVATE">;

export interface TodoActionDraft {
  readonly title: string;
  readonly categoryId: number | null;
  readonly date: DateRef;
  readonly endDate: DateRef | null;
  readonly time: TimeRef | null;
  readonly repeat: PlanRepeatRef;
  /** 말로 비공개를 요청했을 때만 PRIVATE. 언급이 없으면 null(기본 공개 범위) */
  readonly visibility: PlannedVisibility | null;
  readonly items: readonly string[];
  /** 겹친다고 본 다가오는 할 일 id */
  readonly duplicateOfTodoId: number | null;
}

export interface MemoActionDraft {
  readonly title: string;
  readonly content: string;
}

export interface QuickPlanDraft {
  readonly todos: readonly TodoActionDraft[];
  readonly memo: MemoActionDraft | null;
}

interface DigestKeyPointDraft {
  readonly text: string;
  /** 번호 붙인 전사 문장 목록의 index. 고를 문장이 없으면 null */
  readonly sentenceIndex: number | null;
}

export interface VoiceNoteDigestDraft extends QuickPlanDraft {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly DigestKeyPointDraft[];
}

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
