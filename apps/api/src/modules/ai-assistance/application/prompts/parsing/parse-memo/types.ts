import type { ParsedMemoData } from "@aido/api";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { BuiltPrompt, StructuredOutput } from "../../structured-output.js";
import type { PromptCategory } from "../parse-todo/types.js";

export interface ParseMemoPromptInput {
  readonly content: string;
  readonly timezone: string;
  readonly now: Date;
  readonly categories: readonly PromptCategory[];
}

export interface ParseMemoNormalizeContext {
  readonly content: string;
  readonly timezone: string;
  readonly now: Date;
  readonly locale: SupportedLocale;
  readonly ownedCategoryIds: ReadonlySet<number>;
  readonly defaultCategoryId: number;
}

export interface ParseMemoOutcome {
  readonly data: ParsedMemoData;
  /** 메모 전체에 실행할 행동이 없었는지. 이 경우 사용량을 차감하지 않는다. */
  readonly noAction: boolean;
  /** 할 일 상한을 넘어 만들지 않은 할 일 수. 메모 원문은 그대로 남는다. */
  readonly omittedTodoCount: number;
  readonly warnings: readonly string[];
}

export interface ParseMemoPromptDefinition {
  readonly promptVersion: string;
  build(input: ParseMemoPromptInput): BuiltPrompt;
  readonly output: StructuredOutput<ParseMemoOutcome, ParseMemoNormalizeContext>;
}
