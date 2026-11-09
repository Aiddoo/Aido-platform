import { deleteTodoQuerySchema } from "@aido/api";
import type { z } from "zod";

export const DeleteTodoQueryDto = deleteTodoQuerySchema.meta({
  id: "DeleteTodoQueryDto",
  apiParameter: true,
});
export type DeleteTodoQueryDto = z.infer<typeof DeleteTodoQueryDto>;
