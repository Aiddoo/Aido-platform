import { reorderTodoItemsSchema } from "@aido/api";
import type { z } from "zod";

export const ReorderTodoItemsDto = reorderTodoItemsSchema.meta({ id: "ReorderTodoItemsDto" });
export type ReorderTodoItemsDto = z.infer<typeof ReorderTodoItemsDto>;
