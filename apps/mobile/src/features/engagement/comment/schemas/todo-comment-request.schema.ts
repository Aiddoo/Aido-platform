import type { createTodoCommentChainSchema, updateTodoCommentSchema } from '@aido/api';
import type { z } from 'zod';

export type TodoCommentChainInput = z.infer<typeof createTodoCommentChainSchema>;
export type TodoCommentUpdateInput = z.infer<typeof updateTodoCommentSchema>;
