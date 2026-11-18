import { getNudgeInteractionsQuerySchema } from '@aido/api/contracts/nudge/v1';
import type { z } from 'zod';

export const nudgeDirectionSchema = getNudgeInteractionsQuerySchema.shape.direction;
export type NudgeDirection = z.infer<typeof nudgeDirectionSchema>;
