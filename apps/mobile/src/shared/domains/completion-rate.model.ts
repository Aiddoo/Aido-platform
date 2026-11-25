import { FULL_RATE } from '@aido/api/vocabulary';
import { z } from 'zod';

export const MAX_COMPLETION_RATE_PERCENT = FULL_RATE;

export const completionRateSchema = z.number().min(0).max(MAX_COMPLETION_RATE_PERCENT);
