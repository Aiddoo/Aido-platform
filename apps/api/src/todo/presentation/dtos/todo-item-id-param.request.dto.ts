import { todoItemIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const TodoItemIdParamDto = todoItemIdParamSchema.meta({
	id: "TodoItemIdParamDto",
	apiParameter: true,
});
export type TodoItemIdParamDto = z.infer<typeof TodoItemIdParamDto>;
