import type { DayOfWeek } from "@aido/api/vocabulary";

import type { TodoRepeatRule } from "../../shared/domain/todo-draft.constants.js";

/**
 * 서버가 날짜·시각·반복을 계산하고 공개 계약으로 검증한 할 일 초안. 출시 앱이 읽는 요일+종료일(recurrence)과
 * 새 앱이 읽는 반복 규칙(repeat)을 함께 둔다. 요일 배열은 응답에 그대로 넘기려고 변경 가능 배열이다.
 */
export interface ParsedTodo {
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly isAllDay: boolean;
  readonly isRecurring: boolean;
  readonly recurrence: { readonly daysOfWeek: DayOfWeek[]; readonly endDate: string } | null;
  readonly repeat?: TodoRepeatRule | null;
  /** 사용자가 고른 카테고리. 고르지 않았고 모델도 소유 카테고리를 못 골랐으면 없다 */
  readonly categoryId?: number;
}

/** 메모에서 만든 할 일. 요청 기본 카테고리로 채우고 하위 할 일과 겹치는 할 일을 함께 둔다 */
export interface ParsedMemoTodo extends ParsedTodo {
  readonly categoryId: number;
  readonly items: { readonly title: string }[];
  readonly duplicateOfTodoId?: number | null;
}
