import type { SupportedLocale } from "#api/shared/domain/locale";

import type { TodoDraft } from "../../../../../domain/types/parsing/todo-draft.types.js";
import { normalizeTodoDraft } from "../../../../services/parsing/todo-draft.normalizer.js";
import { structuredOutput } from "../../../structured-output.js";
import { todoDraftSchema } from "../../shared/v2/todo-draft.schema.js";
import type {
  ParseTodoNormalizeContext,
  ParseTodoOutcome,
  ParseTodoPromptDefinition,
} from "../types.js";
import { buildParseTodoPromptEnV2 } from "./prompt.en.js";
import { buildParseTodoPromptKoV2 } from "./prompt.ko.js";

export const PARSE_TODO_PROMPT_VERSION_V2 = "parse-todo@v2.1";

function normalizeV2(draft: TodoDraft, context: ParseTodoNormalizeContext): ParseTodoOutcome {
  const { todo, intent, warnings } = normalizeTodoDraft(draft, {
    ...context,
    fallbackTitle: context.text,
  });
  return {
    data: { ...todo, categoryId: context.requestedCategoryId ?? todo.categoryId },
    intent,
    warnings,
  };
}

const outputV2 = structuredOutput(todoDraftSchema, normalizeV2);

export const parseTodoPromptV2: Readonly<Record<SupportedLocale, ParseTodoPromptDefinition>> = {
  ko: {
    promptVersion: PARSE_TODO_PROMPT_VERSION_V2,
    build: buildParseTodoPromptKoV2,
    output: outputV2,
  },
  en: {
    promptVersion: PARSE_TODO_PROMPT_VERSION_V2,
    build: buildParseTodoPromptEnV2,
    output: outputV2,
  },
};
