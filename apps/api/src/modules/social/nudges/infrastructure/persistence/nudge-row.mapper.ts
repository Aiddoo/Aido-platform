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

function toNullableInstant(date: Date | null): Temporal.Instant | null {
  return date == null ? null : instantFromDate(date);
}

function toNullableDate(instant: Temporal.Instant | null): Date | null {
  return instant == null ? null : instantToDate(instant);
}

// DATE 컬럼은 드라이버가 UTC 자정 Date로 준다
function toPlainDate(date: Date): Temporal.PlainDate {
  return instantFromDate(date).toZonedDateTimeISO("UTC").toPlainDate();
}

export function toDateColumn(date: Temporal.PlainDate): Date {
  return instantToDate(date.toZonedDateTime("UTC").toInstant());
}

export function toNudge(row: NudgeRow): Nudge {
  return Nudge.reconstitute({
    ...row,
    readAt: toNullableInstant(row.readAt),
    createdAt: instantFromDate(row.createdAt),
    repliedAt: toNullableInstant(row.repliedAt),
    replyUpdatedAt: toNullableInstant(row.replyUpdatedAt),
    thankedAt: toNullableInstant(row.thankedAt),
  });
}

export function toNudgeRow(nudge: Nudge): NudgeInsertRow {
  const primitives = nudge.toPrimitives();
  return {
    ...primitives,
    readAt: toNullableDate(primitives.readAt),
    createdAt: instantToDate(primitives.createdAt),
    repliedAt: toNullableDate(primitives.repliedAt),
    replyUpdatedAt: toNullableDate(primitives.replyUpdatedAt),
    thankedAt: toNullableDate(primitives.thankedAt),
  };
}

export function toReminderNudge(row: ReminderNudgeRow): ReminderNudge {
  return ReminderNudge.reconstitute({ ...row, createdAt: instantFromDate(row.createdAt) });
}

export function toReminderNudgeRow(reminder: ReminderNudge): ReminderNudgeInsertRow {
  const primitives = reminder.toPrimitives();
  return { ...primitives, createdAt: instantToDate(primitives.createdAt) };
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
    readAt: toNullableInstant(row.readAt),
    createdAt: instantFromDate(row.createdAt),
    replyKind: row.replyKind,
    repliedAt: toNullableInstant(row.repliedAt),
    replyUpdatedAt: toNullableInstant(row.replyUpdatedAt),
    thankedAt: toNullableInstant(row.thankedAt),
    sender: toNudgeUserSummary(row.sender),
    receiver: toNudgeUserSummary(row.receiver),
    todo: toNudgeInteractionTodo(row.todo),
  };
}
