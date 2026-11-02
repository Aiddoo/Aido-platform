import { updateTodoVisibilitySchema } from "@aido/api";
import type { z } from "zod";

export const UpdateTodoVisibilityDto = updateTodoVisibilitySchema.meta({
  id: "UpdateTodoVisibilityDto",
});
export type UpdateTodoVisibilityDto = z.infer<typeof UpdateTodoVisibilityDto>;
