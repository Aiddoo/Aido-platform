import type { reminderNudge as reminderNudgeTable } from "#api/platform/database/schema/index";

import { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";

type ReminderNudgeRow = typeof reminderNudgeTable.$inferSelect;
type ReminderNudgeInsertRow = typeof reminderNudgeTable.$inferInsert;

export function toReminderNudge(row: ReminderNudgeRow): ReminderNudge {
  return ReminderNudge.reconstitute(row);
}

export function toReminderNudgeRow(reminder: ReminderNudge): ReminderNudgeInsertRow {
  return reminder.toPrimitives();
}
