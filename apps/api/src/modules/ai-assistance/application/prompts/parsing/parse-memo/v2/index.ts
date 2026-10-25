import type { SupportedLocale } from "#api/shared/domain/locale";

import { normalizeMemoDraft } from "../../../../services/parsing/todo-draft.normalizer.js";
import { structuredOutput } from "../../../structured-output.js";
import { type MemoDraft, memoDraftSchema } from "../../shared/v2/todo-draft.schema.js";
import type {
  ParseMemoNormalizeContext,
  ParseMemoOutcome,
  ParseMemoPromptDefinition,
} from "../types.js";
import { buildParseMemoPromptEnV2 } from "./prompt.en.js";
import { buildParseMemoPromptKoV2 } from "./prompt.ko.js";

export const PARSE_MEMO_PROMPT_VERSION_V2 = "parse-memo@v2";

function normalizeV2(draft: MemoDraft, context: ParseMemoNormalizeContext): ParseMemoOutcome {
  return normalizeMemoDraft(draft, { ...context, fallbackTitle: context.content });
}

const outputV2 = structuredOutput(memoDraftSchema, normalizeV2);

export const parseMemoPromptV2: Readonly<Record<SupportedLocale, ParseMemoPromptDefinition>> = {
  ko: {
    promptVersion: PARSE_MEMO_PROMPT_VERSION_V2,
    build: buildParseMemoPromptKoV2,
    output: outputV2,
  },
  en: {
    promptVersion: PARSE_MEMO_PROMPT_VERSION_V2,
    build: buildParseMemoPromptEnV2,
    output: outputV2,
  },
};
