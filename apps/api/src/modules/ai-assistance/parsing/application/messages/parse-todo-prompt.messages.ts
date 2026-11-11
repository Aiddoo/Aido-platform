// oxlint-disable-next-line no-restricted-imports -- todo-draft.mapper가 공개 계약으로 검증한 결과 타입이다. ParsedTodo read model로 옮길 때 지운다
import type { ParsedTodoData } from "@aido/api";
import { AI_PARSE_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../generation/application/messages/prompt-definition.messages.js";
import {
  sanitizeLineForPrompt,
  wrapUntrusted,
} from "../../../generation/application/messages/untrusted-input.messages.js";
import type { TodoDraft } from "../../../shared/domain/todo-draft.constants.js";
import { normalizeTodoDraft } from "../todo-draft.mapper.js";
import { todoDraftSchema } from "./parse-todo-draft.wire.js";
import { PARSE_TODO_SYSTEM_EN } from "./parse-todo-system-en.messages.js";
import { PARSE_TODO_SYSTEM_KO } from "./parse-todo-system-ko.messages.js";
import {
  type PromptCategory,
  toPromptCategories,
  buildScheduleContext,
} from "./schedule-context.messages.js";

export interface ParseTodoPromptInput {
  readonly text: string;
  readonly timezone: string;
  readonly now: Date;
  readonly categories: readonly PromptCategory[];
}

/** 모델 출력을 공개 응답으로 바꿀 때 필요한 서버 값 */
export interface ParseTodoNormalizeContext {
  readonly text: string;
  readonly timezone: string;
  readonly now: Date;
  readonly locale: SupportedLocale;
  readonly ownedCategoryIds: ReadonlySet<number>;
  readonly requestedCategoryId: number | undefined;
}

export interface ParseTodoOutcome {
  readonly parsedTodo: ParsedTodoData;
  /** 실행할 행동 없이 모델 대상 명령만 있었는지. 이 경우 사용량을 차감하지 않는다. */
  readonly intent: TodoDraft["intent"];
  readonly warnings: readonly string[];
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: PARSE_TODO_SYSTEM_KO,
  en: PARSE_TODO_SYSTEM_EN,
};

export const parseTodoPrompt: PromptDefinition<
  ParseTodoPromptInput,
  TodoDraft,
  ParseTodoOutcome,
  ParseTodoNormalizeContext
> = {
  id: "parse-todo",
  version: "parse-todo@9",
  taskClass: "interactive",
  // 30개 카테고리(이름 50자)와 500자 입력의 최대 user 턴이 약 3,700자다.
  maxInputChars: 5000,
  schema: todoDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: wrapUntrusted("context", {
        ...buildScheduleContext({ now: input.now, timezone: input.timezone, locale }),
        categories: toPromptCategories(input.categories),
      }),
      input: wrapUntrusted("user_input", {
        text: sanitizeLineForPrompt(input.text, AI_PARSE_LIMITS.TODO_TEXT_MAX_LENGTH),
      }),
    }),
  }),
  normalize: (draft, context) => {
    const { todo, intent, warnings } = normalizeTodoDraft(draft, {
      ...context,
      fallbackTitle: context.text,
    });
    return {
      parsedTodo: { ...todo, categoryId: context.requestedCategoryId ?? todo.categoryId },
      intent,
      warnings,
    };
  },
};
