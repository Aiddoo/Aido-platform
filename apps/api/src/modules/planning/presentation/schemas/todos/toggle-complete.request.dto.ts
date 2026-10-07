import { toggleTodoCompleteSchema } from "@aido/api";
import type { z } from "zod";

export const ToggleTodoCompleteDto = toggleTodoCompleteSchema.meta({ id: "ToggleTodoCompleteDto" });
export type ToggleTodoCompleteDto = z.infer<typeof ToggleTodoCompleteDto>;
