import { updateTodoTitleSchema } from "@aido/api";
import type { z } from "zod";

export const UpdateTodoTitleDto = updateTodoTitleSchema.meta({ id: "UpdateTodoTitleDto" });
export type UpdateTodoTitleDto = z.infer<typeof UpdateTodoTitleDto>;
