import type { DetectedPattern } from "../../../../domain/types/suggestions/ai-suggestion.types.js";
import type { SuggestionContext } from "../../../types/suggestions/suggestion-context.js";
import type { BuiltPrompt, StructuredOutput } from "../../structured-output.js";

export interface SuggestionPromptInput {
  readonly context: SuggestionContext;
}

export interface SuggestionNormalizeContext {
  readonly context: SuggestionContext;
}

export interface SuggestionPromptDefinition {
  readonly promptVersion: string;
  build(input: SuggestionPromptInput): BuiltPrompt;
  /** 근거 검증·요일·시각·사유를 서버가 확정한 저장 후보 */
  readonly output: StructuredOutput<DetectedPattern[], SuggestionNormalizeContext>;
}
