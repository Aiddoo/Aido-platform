import { getNudgeInteractionsQuerySchema } from '@aido/api';
import type { z } from 'zod';

export const nudgeDirectionSchema = getNudgeInteractionsQuerySchema.shape.direction;
export type NudgeDirection = z.infer<typeof nudgeDirectionSchema>;
