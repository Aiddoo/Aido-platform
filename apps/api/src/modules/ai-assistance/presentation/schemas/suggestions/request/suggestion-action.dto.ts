import { suggestionActionSchema } from "@aido/api";
import type { z } from "zod";

export const SuggestionActionDto = suggestionActionSchema.meta({ id: "SuggestionActionDto" });
export type SuggestionActionDto = z.infer<typeof SuggestionActionDto>;
