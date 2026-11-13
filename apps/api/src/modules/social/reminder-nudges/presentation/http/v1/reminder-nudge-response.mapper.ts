import type { CreateRemindNudgeResponse, RemindNudge } from "@aido/api";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { ReminderNudge } from "../../../domain/reminder-nudge.aggregate.js";

const REMINDER_NUDGE_RESPONSE_MESSAGES = {
  SENT: "할일 좀 만들어! 콕 찔렀습니다 👆",
} as const;

function toRemindNudgeResponse(reminder: ReminderNudge): RemindNudge {
  const primitives = reminder.toPrimitives();
  return {
    id: primitives.id,
    senderId: primitives.senderId,
    receiverId: primitives.receiverId,
    message: primitives.message,
    createdAt: toIsoString(primitives.createdAt),
  };
}

export function toCreateRemindNudgeResponse(reminder: ReminderNudge): CreateRemindNudgeResponse {
  return {
    message: REMINDER_NUDGE_RESPONSE_MESSAGES.SENT,
    remindNudge: toRemindNudgeResponse(reminder),
  };
}
