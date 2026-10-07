import { createRecurringTodoSchema } from "@aido/validators";
import type { z } from "zod";

export const CreateRecurringTodoDto = createRecurringTodoSchema.meta({
  id: "CreateRecurringTodoDto",
});
export type CreateRecurringTodoDto = z.infer<typeof CreateRecurringTodoDto>;
