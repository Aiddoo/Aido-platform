import { defineConfig } from "#api/platform/config/define-config";
import { aiSuggestionSchema } from "#api/platform/config/schemas/ai-suggestion.schema";

export const aiAssistanceSuggestionsConfig = defineConfig(
  "aiAssistanceSuggestions",
  aiSuggestionSchema.transform((env) => ({ onDemandEnabled: env.AI_SUGGESTION_ON_DEMAND_ENABLED })),
  (env) => ({ AI_SUGGESTION_ON_DEMAND_ENABLED: env.AI_SUGGESTION_ON_DEMAND_ENABLED }),
);
