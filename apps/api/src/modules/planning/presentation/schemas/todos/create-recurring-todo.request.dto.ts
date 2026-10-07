import { createRecurringTodoSchema } from "@aido/api";
import type { z } from "zod";

export const CreateRecurringTodoDto = createRecurringTodoSchema.meta({
  id: "CreateRecurringTodoDto",
});
export type CreateRecurringTodoDto = z.infer<typeof CreateRecurringTodoDto>;
