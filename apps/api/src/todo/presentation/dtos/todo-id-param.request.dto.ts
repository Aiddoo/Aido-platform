import { todoIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const TodoIdParamDto = todoIdParamSchema.meta({ id: "TodoIdParamDto", apiParameter: true });
export type TodoIdParamDto = z.infer<typeof TodoIdParamDto>;
