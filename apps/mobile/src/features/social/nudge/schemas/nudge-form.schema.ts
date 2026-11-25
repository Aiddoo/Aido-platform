import { createNudgeSchema } from '@aido/api/contracts/nudge/v1';

export const nudgeFormSchema = createNudgeSchema.pick({ message: true });
