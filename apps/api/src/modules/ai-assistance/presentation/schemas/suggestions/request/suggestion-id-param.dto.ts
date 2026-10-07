import { suggestionIdParamSchema } from "@aido/api";
import type { z } from "zod";

export const SuggestionIdParamDto = suggestionIdParamSchema.meta({
  id: "SuggestionIdParamDto",
  apiParameter: true,
});
export type SuggestionIdParamDto = z.infer<typeof SuggestionIdParamDto>;
