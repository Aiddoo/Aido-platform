import { suggestionIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const SuggestionIdParamDto = suggestionIdParamSchema.meta({
  id: "SuggestionIdParamDto",
  apiParameter: true,
});
export type SuggestionIdParamDto = z.infer<typeof SuggestionIdParamDto>;
