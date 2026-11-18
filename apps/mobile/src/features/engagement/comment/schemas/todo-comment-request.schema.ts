import type {
  createTodoCommentChainSchema,
  updateTodoCommentSchema,
} from '@aido/api/contracts/todo-comment/v1';
import type { z } from 'zod';

export type TodoCommentChainInput = z.infer<typeof createTodoCommentChainSchema>;
export type TodoCommentUpdateInput = z.infer<typeof updateTodoCommentSchema>;
