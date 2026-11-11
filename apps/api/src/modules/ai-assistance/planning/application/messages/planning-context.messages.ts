import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import type {
  BuiltPrompt,
  PromptDefinition,
} from "../../../generation/application/messages/prompt-definition.messages.js";
import { wrapUntrusted } from "../../../generation/application/messages/untrusted-input.messages.js";
import {
  type PromptCategory,
  toPromptCategories,
  buildScheduleContext,
} from "../../../parsing/application/messages/schedule-context.messages.js";
import {
  PLANNING_CONTEXT_TITLE_MAX_LENGTH,
  PLANNING_UPCOMING_TODO_LIMIT,
} from "./planning-context.constants.js";

/** 겹침 판정·고유명사 교정에 쓰는 사용자의 다가오는 할 일. 반복 할 일은 다음 회차 하나를 준다. */
interface PlanningUpcomingTodo {
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

/**
 * 맥락은 줄일 수 있지만 말한 내용은 줄일 수 없다. 저장된 제목의 이스케이프로 입력 상한을 넘으면 겹침 후보를
 * 빼고 만든다(겹침은 서버 정책이 다시 판정한다). 그래도 넘으면 생성기가 업체를 부르지 않고 거절한다.
 */
export function buildWithinLimit<I extends { readonly upcomingTodos: readonly unknown[] }, O, R, C>(
  definition: PromptDefinition<I, O, R, C>,
  input: I,
  locale: SupportedLocale,
): BuiltPrompt {
  const built = definition.build(input, locale);
  return built.prompt.length <= definition.maxInputChars
    ? built
    : definition.build({ ...input, upcomingTodos: [] }, locale);
}

/** 계획 프롬프트의 `<context>`: 기준 시각, 카테고리 id·이름, 다가오는 할 일 */
export function buildPlanningContext(input: PlanningContextInput, locale: SupportedLocale): string {
  return wrapUntrusted("context", {
    ...buildScheduleContext({ now: input.now, timezone: input.timezone, locale }),
    categories: toPromptCategories(input.categories),
    upcomingTodos: input.upcomingTodos.slice(0, PLANNING_UPCOMING_TODO_LIMIT).map((todo) => ({
      id: todo.id,
      title: truncateGraphemes(todo.title, PLANNING_CONTEXT_TITLE_MAX_LENGTH),
      date: todo.startDate,
      repeating: todo.isRepeating,
    })),
  });
}
