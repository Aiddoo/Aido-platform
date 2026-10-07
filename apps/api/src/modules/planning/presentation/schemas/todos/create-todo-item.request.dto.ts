import { createTodoItemSchema } from "@aido/api";
import type { z } from "zod";

export const CreateTodoItemDto = createTodoItemSchema.meta({ id: "CreateTodoItemDto" });
export type CreateTodoItemDto = z.infer<typeof CreateTodoItemDto>;
