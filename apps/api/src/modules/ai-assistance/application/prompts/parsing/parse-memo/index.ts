import type { ParsedMemoData } from "@aido/api";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { ExistingTodo } from "../../../../domain/policies/planning/action-plan-dedupe.policy.js";
import { normalizeMemoDraft } from "../../../services/parsing/todo-draft.normalizer.js";
import { composeUserTurn, type PromptDefinition } from "../../kit/prompt-definition.js";
import { sanitizeTextForPrompt, wrapUntrusted } from "../../kit/untrusted-input.js";
import { type PlanningContextInput, planningContext } from "../../planning/planning-context.js";
import { PARSE_MEMO_SYSTEM_EN } from "./prompt.en.js";
import { PARSE_MEMO_SYSTEM_KO } from "./prompt.ko.js";
import { type MemoDraft, memoDraftSchema } from "./schema.js";

export interface ParseMemoPromptInput extends PlanningContextInput {
  readonly content: string;
}

export interface ParseMemoNormalizeContext {
  readonly content: string;
  readonly timezone: string;
  readonly now: Date;
  readonly locale: SupportedLocale;
  readonly ownedCategoryIds: ReadonlySet<number>;
  readonly defaultCategoryId: number;
  /** 프롬프트에 준 겹침 후보. 모델이 고른 id는 이 안의 것만 남기고, 못 골랐으면 제목과 날짜로 다시 찾는다. */
  readonly upcomingTodos: readonly ExistingTodo[];
}

export interface ParseMemoOutcome {
  readonly data: ParsedMemoData;
  /** 메모 전체에 실행할 행동이 없었는지. 이 경우 사용량을 차감하지 않는다. */
  readonly noAction: boolean;
  /** 할 일 상한을 넘어 만들지 않은 할 일 수. 메모 원문은 그대로 남는다. */
  readonly omittedTodoCount: number;
  readonly warnings: readonly string[];
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: PARSE_MEMO_SYSTEM_KO,
  en: PARSE_MEMO_SYSTEM_EN,
};

export const parseMemoPrompt: PromptDefinition<
  ParseMemoPromptInput,
  MemoDraft,
  ParseMemoOutcome,
  ParseMemoNormalizeContext
> = {
  id: "parse-memo",
  version: "parse-memo@7",
  taskClass: "interactive",
  // 30개 카테고리(이름 50자)·다가오는 할 일 30개와 5,000자 메모의 최대 user 턴이 약 13,800자다.
  maxInputChars: 15_000,
  schema: memoDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: planningContext(input, locale),
      input: wrapUntrusted("user_input", {
        memo: sanitizeTextForPrompt(input.content, MEMO_LIMITS.MAX_CONTENT_LENGTH),
      }),
    }),
  }),
  normalize: (draft, context) =>
    normalizeMemoDraft(draft, { ...context, fallbackTitle: context.content }),
};
