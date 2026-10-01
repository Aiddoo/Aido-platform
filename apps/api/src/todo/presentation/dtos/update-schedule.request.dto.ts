import { updateTodoScheduleSchema } from "@aido/validators";
import type { z } from "zod";

export const UpdateTodoScheduleDto = updateTodoScheduleSchema.meta({ id: "UpdateTodoScheduleDto" });
export type UpdateTodoScheduleDto = z.infer<typeof UpdateTodoScheduleDto>;
