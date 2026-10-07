import { llmParsedMemoResultSchema, parsedTodoDataSchema } from "@aido/api";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { buildParseMemoPromptEn } from "./parsing/parse-memo.prompt.en.js";
import { buildParseMemoPrompt } from "./parsing/parse-memo.prompt.js";
import { buildParseTodoPromptEn } from "./parsing/parse-todo.prompt.en.js";
import { buildParseTodoPrompt } from "./parsing/parse-todo.prompt.js";
import { reportPromptCatalog } from "./reports/report.prompt.js";
import { suggestionPromptCatalog } from "./suggestions/detect-patterns.prompt.js";

interface LocalePromptCatalog {
  readonly parseTodo: {
    readonly build: typeof buildParseTodoPrompt;
    readonly schema: typeof parsedTodoDataSchema;
  };
  readonly parseMemo: {
    readonly build: typeof buildParseMemoPrompt;
    readonly schema: typeof llmParsedMemoResultSchema;
  };
  readonly report: (typeof reportPromptCatalog)[SupportedLocale];
  readonly suggestion: (typeof suggestionPromptCatalog)[SupportedLocale];
}

/** 언어를 한 번 선택하면 작업별 지시문과 검증 schema가 함께 선택된다. */
export const aiPromptCatalog = {
  ko: {
    parseTodo: { build: buildParseTodoPrompt, schema: parsedTodoDataSchema },
    parseMemo: { build: buildParseMemoPrompt, schema: llmParsedMemoResultSchema },
    report: reportPromptCatalog.ko,
    suggestion: suggestionPromptCatalog.ko,
  },
  en: {
    parseTodo: { build: buildParseTodoPromptEn, schema: parsedTodoDataSchema },
    parseMemo: { build: buildParseMemoPromptEn, schema: llmParsedMemoResultSchema },
    report: reportPromptCatalog.en,
    suggestion: suggestionPromptCatalog.en,
  },
} satisfies Record<SupportedLocale, LocalePromptCatalog>;
