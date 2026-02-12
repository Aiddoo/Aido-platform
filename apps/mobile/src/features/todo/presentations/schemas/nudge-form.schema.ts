import { z } from 'zod';
import { TodoNudgePolicy } from '../../models/todo-nudge.model';

export const nudgeFormSchema = z.object({
  message: z
    .string()
    .max(
      TodoNudgePolicy.maxMessageLength,
      `메시지는 ${TodoNudgePolicy.maxMessageLength}자까지 입력할 수 있어요`,
    )
    .optional()
    .default(''),
});

export type NudgeFormInput = z.input<typeof nudgeFormSchema>;
