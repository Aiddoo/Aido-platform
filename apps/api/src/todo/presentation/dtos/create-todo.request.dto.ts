import { createTodoSchema } from "@aido/validators";
import type { z } from "zod";

export const CreateTodoDto = createTodoSchema.meta({ id: "CreateTodoDto" });
export type CreateTodoDto = z.infer<typeof CreateTodoDto>;
