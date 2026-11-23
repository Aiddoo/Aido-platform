import { z } from 'zod';

// 서버가 @aido/api/vocabulary completionRate로 0~100을 계산해 보낸다
export const MAX_COMPLETION_RATE_PERCENT = 100;

export const completionRateSchema = z.number().min(0).max(MAX_COMPLETION_RATE_PERCENT);
