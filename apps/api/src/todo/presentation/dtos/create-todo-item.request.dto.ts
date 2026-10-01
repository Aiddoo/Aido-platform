import { createTodoItemSchema } from "@aido/validators";
import type { z } from "zod";

export const CreateTodoItemDto = createTodoItemSchema.meta({ id: "CreateTodoItemDto" });
export type CreateTodoItemDto = z.infer<typeof CreateTodoItemDto>;
