import { defineConfig } from "#api/platform/config/define-config";
import { nudgeSchema } from "#api/platform/config/schemas/nudge.schema";

export const socialNudgesConfig = defineConfig(
  "socialNudges",
  nudgeSchema.transform((env) => ({ interactionsEnabled: env.NUDGE_INTERACTIONS_ENABLED })),
  (env) => ({ NUDGE_INTERACTIONS_ENABLED: env.NUDGE_INTERACTIONS_ENABLED }),
);
