// oxlint-disable-next-line no-restricted-imports -- todo-draft.mapper가 공개 계약으로 검증한 결과 타입이다. ParsedTodo read model로 옮길 때 지운다
import type { ParsedMemoData } from "@aido/api";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../generation/application/messages/prompt-definition.messages.js";
import {
  sanitizeTextForPrompt,
  wrapUntrusted,
} from "../../../generation/application/messages/untrusted-input.messages.js";
import {
  type PlanningContextInput,
  buildPlanningContext,
} from "../../../planning/application/messages/planning-context.messages.js";
import type { ExistingTodo } from "../../../shared/domain/action-plan-dedupe.domain-service.js";
import type { DateRef } from "../../../shared/domain/todo-draft.constants.js";
import { normalizeMemoDraft } from "../todo-draft.mapper.js";
import { type MemoDraft, memoDraftSchema } from "./parse-memo-draft.wire.js";
import { PARSE_MEMO_SYSTEM_EN } from "./parse-memo-system-en.messages.js";
import { PARSE_MEMO_SYSTEM_KO } from "./parse-memo-system-ko.messages.js";

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
  readonly parsedMemo: ParsedMemoData;
  /** 메모 전체에 실행할 행동이 없었는지. 이 경우 사용량을 차감하지 않는다. */
  readonly hasNoAction: boolean;
  /** 할 일 상한을 넘어 만들지 않은 할 일 수. 메모 원문은 그대로 남는다. */
  readonly omittedTodoCount: number;
  readonly warnings: readonly string[];
  /** 모델이 낸 날짜 표현의 종류와 주. 서버가 계산한 날짜와 대조하는 로그용이다. */
  readonly dateRefs: readonly Pick<DateRef, "kind" | "weekOffset">[];
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
  version: "parse-memo@9",
  taskClass: "interactive",
  // 30개 카테고리(이름 50자)·다가오는 할 일 30개와 5,000자 메모의 최대 user 턴이 약 13,800자다.
  maxInputChars: 15_000,
  schema: memoDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: buildPlanningContext(input, locale),
      input: wrapUntrusted("user_input", {
        memo: sanitizeTextForPrompt(input.content, MEMO_LIMITS.MAX_CONTENT_LENGTH),
      }),
    }),
  }),
  normalize: (draft, context) =>
    normalizeMemoDraft(draft, { ...context, fallbackTitle: context.content }),
};
