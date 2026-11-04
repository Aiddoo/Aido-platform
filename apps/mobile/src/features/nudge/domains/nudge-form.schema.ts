import { createNudgeSchema } from '@aido/api';
import type { z } from 'zod';

export const nudgeFormSchema = createNudgeSchema.pick({ message: true });

export type NudgeFormInput = z.output<typeof nudgeFormSchema>;
