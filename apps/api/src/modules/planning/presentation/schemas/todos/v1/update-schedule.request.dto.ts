import { updateTodoScheduleSchema } from "@aido/api";
import type { z } from "zod";

export const UpdateTodoScheduleDto = updateTodoScheduleSchema.meta({ id: "UpdateTodoScheduleDto" });
export type UpdateTodoScheduleDto = z.infer<typeof UpdateTodoScheduleDto>;
