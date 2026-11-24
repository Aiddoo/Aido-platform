import { todoImportIdParamSchema } from '@aido/api/contracts/todo-import/v1';
import { z } from 'zod';

export const todoImportParamsSchema = z.object({
  importId: todoImportIdParamSchema.shape.importId,
});
