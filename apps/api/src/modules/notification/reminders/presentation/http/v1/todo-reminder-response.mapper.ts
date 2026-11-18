import { toIsoString } from "#api/shared/domain/time/instant";

import type { TodoReminderSnooze } from "../../../application/use-cases/snooze-todo-reminder.use-case.js";
import type { TodoReminderSnoozeResponseDto } from "./todo-reminder.dto.js";

export function toTodoReminderSnoozeResponse(
  snooze: TodoReminderSnooze,
): TodoReminderSnoozeResponseDto {
  return { remindAt: toIsoString(snooze.remindAt) };
}
