import { suggestionActionResponseSchema, suggestionListResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const SuggestionListResponseDto = suggestionListResponseSchema.meta({
  id: "SuggestionListResponseDto",
});
export type SuggestionListResponseDto = z.infer<typeof SuggestionListResponseDto>;

export const SuggestionActionResponseDto = suggestionActionResponseSchema.meta({
  id: "SuggestionActionResponseDto",
});
export type SuggestionActionResponseDto = z.infer<typeof SuggestionActionResponseDto>;
