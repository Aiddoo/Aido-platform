import { updateTodoItemSchema } from "@aido/validators";
import type { z } from "zod";

export const UpdateTodoItemDto = updateTodoItemSchema.meta({ id: "UpdateTodoItemDto" });
export type UpdateTodoItemDto = z.infer<typeof UpdateTodoItemDto>;
