import { createNudgeSchema } from '@aido/api';
import type { z } from 'zod';

export const nudgeFormSchema = createNudgeSchema.pick({ message: true });

export type NudgeFormValues = z.output<typeof nudgeFormSchema>;
