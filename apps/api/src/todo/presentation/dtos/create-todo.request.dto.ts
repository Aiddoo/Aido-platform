import { createTodoSchema } from "@aido/api";
import type { z } from "zod";

export const CreateTodoDto = createTodoSchema.meta({ id: "CreateTodoDto" });
export type CreateTodoDto = z.infer<typeof CreateTodoDto>;
