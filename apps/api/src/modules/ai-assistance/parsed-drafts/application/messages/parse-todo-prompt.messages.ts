import { AI_PARSE_LIMITS, type Localized, type SupportedLocale } from "@aido/api/vocabulary";

import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import {
  sanitizeLineForPrompt,
  wrapUntrusted,
} from "../../../ai-generations/application/messages/untrusted-input.messages.js";
import { ParsedDraft } from "../../domain/parsed-draft.aggregate.js";
import { normalizeTodoDraft } from "../todo-draft.mapper.js";
import { PARSE_TODO_SYSTEM_EN } from "./locales/en/parse-todo-system.messages.js";
import { PARSE_TODO_SYSTEM_KO } from "./locales/ko/parse-todo-system.messages.js";
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
  /** 실행할 행동 없이 모델 대상 명령만 있었으면 사용량을 차감하지 않는 초안이다. */
  readonly draft: ParsedDraft;
  readonly warnings: readonly string[];
}

const SYSTEM: Localized<string> = {
  ko: PARSE_TODO_SYSTEM_KO,
  en: PARSE_TODO_SYSTEM_EN,
};

export const parseTodoPrompt: PromptDefinition<
  "parse-todo",
  ParseTodoPromptInput,
  ParseTodoOutcome,
  ParseTodoNormalizeContext
> = {
  id: "parse-todo",
  version: "parse-todo@10",
  taskClass: "interactive",
  // 30개 카테고리(이름 50자)와 500자 입력의 최대 user 턴이 약 3,700자다.
  maxInputChars: 5000,
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
  normalize: (raw, context) => {
    const { todo, intent, warnings } = normalizeTodoDraft(raw, {
      ...context,
      fallbackTitle: context.text,
    });
    const draft = ParsedDraft.create({
      todos: [{ ...todo, categoryId: context.requestedCategoryId ?? todo.categoryId }],
      omittedTodoCount: 0,
      hasAction: intent === "TASK",
    });
    return { draft, warnings };
  },
};
