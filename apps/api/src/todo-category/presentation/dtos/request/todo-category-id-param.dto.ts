import { todoCategoryIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const TodoCategoryIdParamDto = todoCategoryIdParamSchema.meta({
  id: "TodoCategoryIdParamDto",
  apiParameter: true,
});
export type TodoCategoryIdParamDto = z.infer<typeof TodoCategoryIdParamDto>;
