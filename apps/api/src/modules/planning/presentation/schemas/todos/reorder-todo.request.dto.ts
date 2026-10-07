import { reorderTodoSchema } from "@aido/api";
import type { z } from "zod";

export const ReorderTodoDto = reorderTodoSchema.meta({ id: "ReorderTodoDto" });
export type ReorderTodoDto = z.infer<typeof ReorderTodoDto>;
