import { updateTodoSchema } from "@aido/api";
import type { z } from "zod";

export const UpdateTodoDto = updateTodoSchema.meta({ id: "UpdateTodoDto" });
export type UpdateTodoDto = z.infer<typeof UpdateTodoDto>;
