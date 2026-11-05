import type { ParsedTodoData } from "@aido/api";
import { AI_PARSE_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { TodoDraft } from "../../../../domain/types/parsing/todo-draft.types.js";
import { normalizeTodoDraft } from "../../../services/parsing/todo-draft.normalizer.js";
import { composeUserTurn, type PromptDefinition } from "../../kit/prompt-definition.js";
import { sanitizeLineForPrompt, wrapUntrusted } from "../../kit/untrusted-input.js";
import {
  type PromptCategory,
  promptCategories,
  scheduleContext,
} from "../schedule/schedule-context.js";
import { PARSE_TODO_SYSTEM_EN } from "./prompt.en.js";
import { PARSE_TODO_SYSTEM_KO } from "./prompt.ko.js";
import { todoDraftSchema } from "./schema.js";

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
  readonly data: ParsedTodoData;
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
  version: "parse-todo@7",
  taskClass: "interactive",
  // 30개 카테고리(이름 50자)와 500자 입력의 최대 user 턴이 약 3,700자다.
  maxInputChars: 5_000,
  schema: todoDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: wrapUntrusted("context", {
        ...scheduleContext({ now: input.now, timezone: input.timezone, locale }),
        categories: promptCategories(input.categories),
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
      data: { ...todo, categoryId: context.requestedCategoryId ?? todo.categoryId },
      intent,
      warnings,
    };
  },
};
