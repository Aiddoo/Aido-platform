import {
  snoozeTodoReminderSchema,
  todoReminderParamSchema,
  todoReminderSnoozeResponseSchema,
} from "@aido/api/contracts/notification/v1";
import type { z } from "zod";

export const TodoReminderParamDto = todoReminderParamSchema.meta({
  id: "TodoReminderParamDto",
  apiParameter: true,
});
export type TodoReminderParamDto = z.infer<typeof TodoReminderParamDto>;
export const SnoozeTodoReminderDto = snoozeTodoReminderSchema.meta({ id: "SnoozeTodoReminderDto" });
export type SnoozeTodoReminderDto = z.infer<typeof SnoozeTodoReminderDto>;

export const TodoReminderSnoozeResponseDto = todoReminderSnoozeResponseSchema.meta({
  id: "TodoReminderSnoozeResponseDto",
});
export type TodoReminderSnoozeResponseDto = z.infer<typeof TodoReminderSnoozeResponseDto>;
