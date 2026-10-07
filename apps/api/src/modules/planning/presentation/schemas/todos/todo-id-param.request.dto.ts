import { todoIdParamSchema } from "@aido/api";
import type { z } from "zod";

export const TodoIdParamDto = todoIdParamSchema.meta({ id: "TodoIdParamDto", apiParameter: true });
export type TodoIdParamDto = z.infer<typeof TodoIdParamDto>;
