import { z } from "zod";

export const aiSuggestionSchema = z.object({
  AI_SUGGESTION_ON_DEMAND_ENABLED: z.stringbool().default(true),
});

export type AiSuggestionConfig = z.infer<typeof aiSuggestionSchema>;
