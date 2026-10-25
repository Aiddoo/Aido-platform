import {
  type LlmParsedMemoResult,
  llmParsedMemoResultSchema,
  parsedMemoDataSchema,
} from "@aido/api";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { structuredOutput } from "../../../structured-output.js";
import type {
  ParseMemoNormalizeContext,
  ParseMemoOutcome,
  ParseMemoPromptDefinition,
} from "../types.js";
import { buildParseMemoPromptEn } from "./prompt.en.js";
import { buildParseMemoPrompt } from "./prompt.ko.js";

export const PARSE_MEMO_PROMPT_VERSION_V1 = "parse-memo@v1";

function normalizeV1(
  output: LlmParsedMemoResult,
  context: ParseMemoNormalizeContext,
): ParseMemoOutcome {
  return {
    data: parsedMemoDataSchema.parse({
      todos: output.todos.slice(0, 5).map((todo) => ({
        ...todo,
        categoryId: context.ownedCategoryIds.has(todo.categoryId)
          ? todo.categoryId
          : context.defaultCategoryId,
      })),
    }),
    noAction: false,
    warnings: [],
  };
}

const outputV1 = structuredOutput(llmParsedMemoResultSchema, normalizeV1);

export const parseMemoPromptV1: Readonly<Record<SupportedLocale, ParseMemoPromptDefinition>> = {
  ko: {
    promptVersion: PARSE_MEMO_PROMPT_VERSION_V1,
    build: (input) =>
      buildParseMemoPrompt(input.content, input.timezone, input.now, [...input.categories]),
    output: outputV1,
  },
  en: {
    promptVersion: PARSE_MEMO_PROMPT_VERSION_V1,
    build: (input) =>
      buildParseMemoPromptEn(input.content, input.timezone, input.now, [...input.categories]),
    output: outputV1,
  },
};
