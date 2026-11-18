import { type Localized, MEMO_LIMITS, type SupportedLocale } from "@aido/api/vocabulary";

import {
  type PlanningContextInput,
  buildPlanningContext,
} from "../../../action-plan-drafts/application/messages/planning-context.messages.js";
import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import {
  sanitizeTextForPrompt,
  wrapUntrusted,
} from "../../../ai-generations/application/messages/untrusted-input.messages.js";
import type { ExistingTodo } from "../../../shared/domain/action-plan-dedupe.domain-service.js";
import type { DateRef } from "../../../shared/domain/todo-draft.constants.js";
import { ParsedDraft } from "../../domain/parsed-draft.aggregate.js";
import type { ParsedMemoTodo } from "../../domain/parsed-drafts.constants.js";
import { normalizeMemoDraft } from "../todo-draft.mapper.js";
import { PARSE_MEMO_SYSTEM_EN } from "./locales/en/parse-memo-system.messages.js";
import { PARSE_MEMO_SYSTEM_KO } from "./locales/ko/parse-memo-system.messages.js";

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
  /** 할 일 상한을 넘어 만들지 않은 할 일 수는 초안에 둔다. 메모 원문은 그대로 남는다. */
  readonly draft: ParsedDraft<ParsedMemoTodo>;
  readonly warnings: readonly string[];
  /** 모델이 낸 날짜 표현의 종류와 주. 서버가 계산한 날짜와 대조하는 로그용이다. */
  readonly dateRefs: readonly Pick<DateRef, "kind" | "weekOffset">[];
}

const SYSTEM: Localized<string> = {
  ko: PARSE_MEMO_SYSTEM_KO,
  en: PARSE_MEMO_SYSTEM_EN,
};

export const parseMemoPrompt: PromptDefinition<
  "parse-memo",
  ParseMemoPromptInput,
  ParseMemoOutcome,
  ParseMemoNormalizeContext
> = {
  id: "parse-memo",
  version: "parse-memo@10",
  taskClass: "interactive",
  // 30개 카테고리(이름 50자)·다가오는 할 일 30개와 5,000자 메모의 최대 user 턴이 약 13,800자다.
  maxInputChars: 15_000,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: buildPlanningContext(input, locale),
      input: wrapUntrusted("user_input", {
        memo: sanitizeTextForPrompt(input.content, MEMO_LIMITS.MAX_CONTENT_LENGTH),
      }),
    }),
  }),
  normalize: (raw, context) => {
    const { parsedMemo, hasNoAction, omittedTodoCount, warnings, dateRefs } = normalizeMemoDraft(
      raw,
      { ...context, fallbackTitle: context.content },
    );
    const draft = ParsedDraft.create<ParsedMemoTodo>({
      todos: parsedMemo.todos,
      omittedTodoCount,
      hasAction: !hasNoAction,
    });
    return { draft, warnings, dateRefs };
  },
};
