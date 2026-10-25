import type { ParsedTodoData } from "@aido/api";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type { BuiltPrompt, StructuredOutput } from "../../structured-output.js";

export interface PromptCategory {
  readonly id: number;
  readonly name: string;
}

export interface ParseTodoPromptInput {
  readonly text: string;
  readonly timezone: string;
  readonly now: Date;
  readonly categories: readonly PromptCategory[];
}

/** 모델 출력을 공개 응답으로 바꿀 때 필요한 서버 값 */
export interface ParseTodoNormalizeContext {
  readonly text: string;
  readonly timezone: string;
  readonly now: Date;
  readonly locale: SupportedLocale;
  readonly ownedCategoryIds: ReadonlySet<number>;
  readonly requestedCategoryId: number | undefined;
}

export interface ParseTodoOutcome {
  readonly data: ParsedTodoData;
  /** 실행할 행동 없이 모델 대상 명령만 있었는지. 이 경우 사용량을 차감하지 않는다. */
  readonly intent: "TASK" | "NO_ACTION";
  readonly warnings: readonly string[];
}

export interface ParseTodoPromptDefinition {
  readonly promptVersion: string;
  build(input: ParseTodoPromptInput): BuiltPrompt;
  readonly output: StructuredOutput<ParseTodoOutcome, ParseTodoNormalizeContext>;
}
