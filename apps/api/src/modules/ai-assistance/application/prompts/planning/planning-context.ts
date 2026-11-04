import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { wrapUntrusted } from "../kit/untrusted-input.js";
import {
  type PromptCategory,
  promptCategories,
  scheduleContext,
} from "../parsing/schedule/schedule-context.js";
import {
  PLANNING_CONTEXT_TITLE_MAX_LENGTH,
  PLANNING_UPCOMING_TODO_LIMIT,
} from "./planning-prompt.constants.js";

/** 겹침 판정·고유명사 교정에 쓰는 사용자의 다가오는 할 일. 반복 할 일은 다음 회차 하나를 준다. */
export interface PlanningUpcomingTodo {
  readonly id: number;
  readonly title: string;
  readonly startDate: string;
  readonly isRepeating: boolean;
}

export interface PlanningContextInput {
  readonly now: Date;
  readonly timezone: string;
  readonly categories: readonly PromptCategory[];
  readonly upcomingTodos: readonly PlanningUpcomingTodo[];
}

/** 계획 프롬프트의 `<context>`: 기준 시각, 카테고리 id·이름, 다가오는 할 일 */
export function planningContext(input: PlanningContextInput, locale: SupportedLocale): string {
  return wrapUntrusted("context", {
    ...scheduleContext({ now: input.now, timezone: input.timezone, locale }),
    categories: promptCategories(input.categories),
    upcomingTodos: input.upcomingTodos.slice(0, PLANNING_UPCOMING_TODO_LIMIT).map((todo) => ({
      id: todo.id,
      title: truncateGraphemes(todo.title, PLANNING_CONTEXT_TITLE_MAX_LENGTH),
      date: todo.startDate,
      repeating: todo.isRepeating,
    })),
  });
}
