import { reorderTodoSchema } from "@aido/validators";
import type { z } from "zod";

export const ReorderTodoDto = reorderTodoSchema.meta({ id: "ReorderTodoDto" });
export type ReorderTodoDto = z.infer<typeof ReorderTodoDto>;
