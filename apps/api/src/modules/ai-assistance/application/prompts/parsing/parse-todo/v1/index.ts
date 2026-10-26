// TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
import { type ParsedTodoData, parsedTodoDataSchema } from "@aido/api";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { structuredOutput } from "../../../structured-output.js";
import type {
  ParseTodoNormalizeContext,
  ParseTodoOutcome,
  ParseTodoPromptDefinition,
} from "../types.js";
import { buildParseTodoPromptEn } from "./prompt.en.js";
import { buildParseTodoPrompt } from "./prompt.ko.js";

/** @deprecated parse-todo v2로 대체됐다. AI_PROMPT_VERSION 롤백용으로만 남긴다. */
export const PARSE_TODO_PROMPT_VERSION_V1 = "parse-todo@v1";

function normalizeV1(output: ParsedTodoData, context: ParseTodoNormalizeContext): ParseTodoOutcome {
  const inferredCategoryId = context.ownedCategoryIds.has(output.categoryId ?? 0)
    ? output.categoryId
    : undefined;
  return {
    data: { ...output, categoryId: context.requestedCategoryId ?? inferredCategoryId },
    intent: "TASK",
    warnings: [],
  };
}

const outputV1 = structuredOutput(parsedTodoDataSchema, normalizeV1);

/** @deprecated parse-todo v2로 대체됐다. AI_PROMPT_VERSION 롤백용으로만 남긴다. */
export const parseTodoPromptV1: Readonly<Record<SupportedLocale, ParseTodoPromptDefinition>> = {
  ko: {
    promptVersion: PARSE_TODO_PROMPT_VERSION_V1,
    build: (input) =>
      buildParseTodoPrompt(input.text, input.timezone, input.now, [...input.categories]),
    output: outputV1,
  },
  en: {
    promptVersion: PARSE_TODO_PROMPT_VERSION_V1,
    build: (input) =>
      buildParseTodoPromptEn(input.text, input.timezone, input.now, [...input.categories]),
    output: outputV1,
  },
};
