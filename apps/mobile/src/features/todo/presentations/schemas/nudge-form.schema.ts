import { t } from '@src/shared/i18n';
import { z } from 'zod';
import { TodoNudgePolicy } from '../../models/todo-nudge.model';

export const nudgeFormSchema = z.object({
  message: z
    .string()
    .max(TodoNudgePolicy.maxMessageLength, {
      error: () => t('todo:form.nudgeMessageMax', { count: TodoNudgePolicy.maxMessageLength }),
    })
    .optional()
    .default(''),
});

export type NudgeFormInput = z.input<typeof nudgeFormSchema>;
