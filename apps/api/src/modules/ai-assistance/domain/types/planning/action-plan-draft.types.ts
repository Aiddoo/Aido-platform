import type { DateRef, RepeatRef, ScheduleDraft, TimeRef } from "../parsing/todo-draft.types.js";

/**
 * 계획 프롬프트(quick-plan·voice-note-digest)가 내는 행동 표현.
 * 일정은 날짜가 아니라 표현(ScheduleDraft)이고, 서버 resolver가 사용자 시간대로 계산한다.
 */
export interface CreateTodoActionDraft {
  readonly type: "CREATE_TODO";
  readonly title: string;
  readonly categoryId: number | null;
  readonly date: DateRef;
  readonly endDate: DateRef | null;
  readonly time: TimeRef | null;
  readonly repeat: RepeatRef;
  /** 말로 비공개를 요청했을 때만 PRIVATE. 언급이 없으면 null(기본 공개 범위) */
  readonly visibility: "PRIVATE" | null;
  readonly items: readonly string[];
  /** 겹친다고 본 다가오는 할 일 id */
  readonly duplicateOfTodoId: number | null;
}

export interface CreateMemoActionDraft {
  readonly type: "CREATE_MEMO";
  readonly title: string;
  readonly content: string;
}

export type PlannedActionDraft = CreateTodoActionDraft | CreateMemoActionDraft;

export interface QuickPlanDraft {
  readonly actions: readonly PlannedActionDraft[];
}

export interface DigestKeyPointDraft {
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
  readonly schedule: ScheduleDraft;
  readonly visibility: "PRIVATE" | null;
  readonly items: readonly string[];
  readonly duplicateOfTodoId: number | null;
}

export interface PlannedMemoDraft {
  readonly title: string;
  readonly content: string;
}

export type ActionPlanWarning =
  | "TODOS_TRUNCATED"
  | "MEMOS_TRUNCATED"
  | "ITEMS_TRUNCATED"
  | "UNKNOWN_CATEGORY"
  | "UNKNOWN_DUPLICATE"
  | "EMPTY_TITLE"
  | "REPEAT_WITH_END_DATE";

export interface NormalizedActionPlan {
  readonly todos: readonly PlannedTodoDraft[];
  readonly memo: PlannedMemoDraft | null;
  /** 할 일 상한을 넘어 버린 할 일 수 */
  readonly omittedTodoCount: number;
  readonly warnings: readonly ActionPlanWarning[];
}

export interface NormalizedDigestKeyPoint {
  readonly text: string;
  readonly sentenceIndex: number | null;
}

export interface NormalizedVoiceNoteDigest {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly NormalizedDigestKeyPoint[];
  readonly plan: NormalizedActionPlan;
}
