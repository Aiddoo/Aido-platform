import { quickPlanRequestSchema } from '@aido/api';
import type { z } from 'zod';

import { voicePlanSourceSchema } from '../domains/voice-plan.model';

// 입력 경로는 앱의 말(quick-voice·quick-text)로 받고 mapper가 계약 값으로 바꾼다
const createQuickPlanInputSchema = quickPlanRequestSchema
  .pick({ text: true })
  .extend({ source: voicePlanSourceSchema.extract(['quick-voice', 'quick-text']) });
export type CreateQuickPlanInput = z.infer<typeof createQuickPlanInputSchema>;
