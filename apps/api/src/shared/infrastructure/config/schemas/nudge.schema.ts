import { z } from "zod";

export const nudgeSchema = z.object({
	NUDGE_INTERACTIONS_ENABLED: z.stringbool().default(false),
});

export type NudgeConfig = z.infer<typeof nudgeSchema>;
