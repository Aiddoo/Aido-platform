import { z } from 'zod';

import { TODO_REPEAT_KINDS, todoRepeatSchema } from './todo-repeat.model';

export const todoRepeatFormSchema = z.object({
  kind: z.enum(TODO_REPEAT_KINDS),
  repeat: todoRepeatSchema.nullable(),
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormSchema>;
