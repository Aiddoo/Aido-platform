import type { DayOfWeek, TodoVisibility } from "@aido/api/vocabulary";

import type { DateRef, PlanRepeatRef, TimeRef, TodoDraft } from "./todo-draft.constants.js";

// 작업마다 모델이 내는 업체 중립 출력이다. 생성 slice의 LLM schema와 정규화하는 slice가 함께 쓰므로 shared에 둔다

/** 메모 draft의 할 일. 하위 단계와 겹친다고 본 다가오는 할 일 id를 더한다 */
interface MemoTodoDraft extends TodoDraft {
  readonly items: readonly { readonly title: string }[];
  readonly duplicateOfTodoId: number | null;
}

/** 모델이 돌려준 메모 draft. totalTaskCount는 모델이 쓰지 않은 할 일까지 센 메모 전체 할 일 수다. */
export interface MemoDraft {
  readonly todos: readonly MemoTodoDraft[];
  readonly totalTaskCount: number | null;
}

/** 계획은 말로 비공개를 요청했을 때만 공개 범위를 정한다 */
export type PlannedVisibility = Extract<TodoVisibility, "PRIVATE">;

/**
 * 계획 프롬프트(quick-plan·voice-note-digest)가 내는 표현. 도구 입력에서 유니온 배열이 문자열로 깨져 오는 일이
 * 있어 모델 출력은 할 일 목록과 메모 하나로 나눈다.
 * 일정은 날짜가 아니라 표현(ScheduleDraft)이고, 서버 resolver가 사용자 시간대로 계산한다.
 */
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

/** 모델이 쓴 코치 카드 한 장. 길이·개수·숫자 근거는 서버가 맞춘다 */
export interface ReportDraft {
  /** report_data.focus.items의 key. null이면 전체에 대한 글이다 */
  readonly insightKey: string | null;
  readonly insight: string;
  readonly tips: readonly string[];
}

/** 모델이 고른 후보 하나. 근거 문장·신뢰도·상한은 서버가 정한다 */
interface SuggestionPickDraft {
  readonly candidateId: string;
  readonly daysOfWeek: readonly DayOfWeek[];
  readonly useRecordedTime: boolean;
}

export interface SuggestionDraft {
  readonly picks: readonly SuggestionPickDraft[];
}
