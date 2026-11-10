import type {
  nudge as nudgeTable,
  reminderNudge as reminderNudgeTable,
  todo as todoTable,
} from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import type { UserBriefRow } from "../../../friends/infrastructure/persistence/user-brief-relation.constants.js";
import type { NudgeInteractionTodo } from "../../application/read-models/nudge-interaction.read-model.js";
import type {
  NudgeListItem,
  NudgeUserSummary,
} from "../../application/read-models/nudge.read-model.js";
import { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import { Nudge } from "../../domain/nudge.aggregate.js";
import { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";

type NudgeRow = typeof nudgeTable.$inferSelect;
type NudgeInsertRow = typeof nudgeTable.$inferInsert;
type ReminderNudgeRow = typeof reminderNudgeTable.$inferSelect;
type ReminderNudgeInsertRow = typeof reminderNudgeTable.$inferInsert;
type TodoRow = typeof todoTable.$inferSelect;

export type InteractionTodoRow = Pick<
  TodoRow,
  "id" | "userId" | "title" | "completed" | "visibility"
>;

export type NudgeRowWithRelations = NudgeRow & {
  readonly sender: UserBriefRow;
  readonly receiver: UserBriefRow;
  readonly todo: InteractionTodoRow;
};

// planning Todo의 DATE 컬럼은 아직 드라이버가 UTC 자정 Date로 준다
function toPlainDate(date: Date): Temporal.PlainDate {
  return instantFromDate(date).toZonedDateTimeISO("UTC").toPlainDate();
}

export function toDateColumn(date: Temporal.PlainDate): Date {
  return instantToDate(date.toZonedDateTime("UTC").toInstant());
}

export function toNudge(row: NudgeRow): Nudge {
  return Nudge.reconstitute(row);
}

export function toNudgeRow(nudge: Nudge): NudgeInsertRow {
  return nudge.toPrimitives();
}

export function toReminderNudge(row: ReminderNudgeRow): ReminderNudge {
  return ReminderNudge.reconstitute(row);
}

export function toReminderNudgeRow(reminder: ReminderNudge): ReminderNudgeInsertRow {
  return reminder.toPrimitives();
}

export function toNudgeTargetTodo(
  row: Pick<TodoRow, "userId" | "title" | "visibility" | "startDate" | "endDate">,
): NudgeTargetTodo {
  return NudgeTargetTodo.reconstitute({
    ownerId: row.userId,
    title: row.title,
    visibility: row.visibility,
    startDate: toPlainDate(row.startDate),
    endDate: row.endDate == null ? null : toPlainDate(row.endDate),
  });
}

export function toNudgeInteractionTodo(row: InteractionTodoRow): NudgeInteractionTodo {
  return {
    id: row.id,
    ownerId: row.userId,
    title: row.title,
    completed: row.completed,
    visibility: row.visibility,
  };
}

export function toNudgeUserSummary(row: UserBriefRow): NudgeUserSummary {
  return {
    id: row.id,
    userTag: row.userTag,
    name: row.profile?.name ?? null,
    profileImage: row.profile?.profileImage ?? null,
  };
}

export function toNudgeListItem(row: NudgeRowWithRelations): NudgeListItem {
  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    todoId: row.todoId,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
    replyKind: row.replyKind,
    repliedAt: row.repliedAt,
    replyUpdatedAt: row.replyUpdatedAt,
    thankedAt: row.thankedAt,
    sender: toNudgeUserSummary(row.sender),
    receiver: toNudgeUserSummary(row.receiver),
    todo: toNudgeInteractionTodo(row.todo),
  };
}
