import {
  suggestionActionResponseSchema,
  suggestionActionSchema,
  suggestionIdParamSchema,
  suggestionListResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const SuggestionActionDto = suggestionActionSchema.meta({ id: "SuggestionActionDto" });
export type SuggestionActionDto = z.infer<typeof SuggestionActionDto>;

export const SuggestionIdParamDto = suggestionIdParamSchema.meta({
  id: "SuggestionIdParamDto",
  apiParameter: true,
});
export type SuggestionIdParamDto = z.infer<typeof SuggestionIdParamDto>;

export const SuggestionListResponseDto = suggestionListResponseSchema.meta({
  id: "SuggestionListResponseDto",
});
export type SuggestionListResponseDto = z.infer<typeof SuggestionListResponseDto>;

export const SuggestionActionResponseDto = suggestionActionResponseSchema.meta({
  id: "SuggestionActionResponseDto",
});
export type SuggestionActionResponseDto = z.infer<typeof SuggestionActionResponseDto>;
