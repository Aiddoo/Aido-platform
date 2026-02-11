import { z } from 'zod';

export const nudgeFormSchema = z.object({
  message: z.string().max(200, '메시지는 200자까지 입력할 수 있어요').optional().default(''),
});

export type NudgeFormInput = z.input<typeof nudgeFormSchema>;
