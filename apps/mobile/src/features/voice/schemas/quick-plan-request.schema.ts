import { quickPlanRequestSchema } from '@aido/api';
import { z } from 'zod';

// 입력 경로는 앱의 말(voice·text)로 받고 mapper가 계약 값으로 바꾼다
const createQuickPlanInputSchema = quickPlanRequestSchema
  .pick({ text: true })
  .extend({ source: z.enum(['voice', 'text']) });
export type CreateQuickPlanInput = z.infer<typeof createQuickPlanInputSchema>;
