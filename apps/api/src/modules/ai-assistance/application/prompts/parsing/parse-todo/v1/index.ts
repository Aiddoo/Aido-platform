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
