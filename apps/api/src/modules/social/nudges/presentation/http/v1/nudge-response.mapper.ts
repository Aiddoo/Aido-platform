import type {
  CreateNudgeResponse,
  CreateRemindNudgeResponse,
  MarkNudgeReadResponse,
  Nudge as NudgeResponse,
  NudgeCooldownInfo,
  NudgeDetail,
  NudgeLimitInfo,
  NudgeSender,
  ReceivedNudgesResponse,
  RemindNudge,
  SentNudgesResponse,
} from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { SendCooldown } from "../../../../shared/domain/send-cooldown.domain-service.js";
import type {
  NudgeDailyLimit,
  NudgeListItem,
  NudgeUserSummary,
  ReceivedNudges,
  SentNudges,
} from "../../../application/read-models/nudge.read-model.js";
import type { Nudge } from "../../../domain/nudge.aggregate.js";
import type { ReminderNudge } from "../../../domain/reminder-nudge.aggregate.js";

const NUDGE_RESPONSE_MESSAGES = {
  SENT: "콕! 찔렀습니다 👆",
  REMINDER_SENT: "할일 좀 만들어! 콕 찔렀습니다 👆",
  READ: "확인했습니다.",
} as const;

export function toNullableIsoString(instant: Temporal.Instant | null): string | null {
  return instant == null ? null : toIsoString(instant);
}

export function toNudgeUserResponse(user: NudgeUserSummary, appVersion?: string): NudgeSender {
  return {
    id: user.id,
    userTag: user.userTag,
    name: user.name,
    profileImage: resolveProfileImage(user.profileImage, appVersion),
  };
}

export function toNudgeResponse(
  nudge: Pick<
    NudgeListItem,
    "id" | "senderId" | "receiverId" | "todoId" | "message" | "readAt" | "createdAt"
  >,
): NudgeResponse {
  return {
    id: nudge.id,
    senderId: nudge.senderId,
    receiverId: nudge.receiverId,
    todoId: nudge.todoId,
    message: nudge.message,
    createdAt: toIsoString(nudge.createdAt),
    readAt: toNullableIsoString(nudge.readAt),
  };
}

export function toCreateNudgeResponse(nudge: Nudge): CreateNudgeResponse {
  return { message: NUDGE_RESPONSE_MESSAGES.SENT, nudge: toNudgeResponse(nudge.toPrimitives()) };
}

function toNudgeDetailResponse(nudge: NudgeListItem, appVersion?: string): NudgeDetail {
  return {
    ...toNudgeResponse(nudge),
    sender: toNudgeUserResponse(nudge.sender, appVersion),
    todo: { id: nudge.todo.id, title: nudge.todo.title, completed: nudge.todo.completed },
  };
}

export function toReceivedNudgesResponse(
  received: ReceivedNudges,
  appVersion?: string,
): ReceivedNudgesResponse {
  return {
    nudges: received.page.items.map((nudge) => toNudgeDetailResponse(nudge, appVersion)),
    totalCount: received.totalCount,
    unreadCount: received.unreadCount,
    hasMore: received.page.pagination.hasNext,
  };
}

export function toSentNudgesResponse(sent: SentNudges, appVersion?: string): SentNudgesResponse {
  return {
    nudges: sent.page.items.map((nudge) => toNudgeDetailResponse(nudge, appVersion)),
    totalCount: sent.totalCount,
    hasMore: sent.page.pagination.hasNext,
  };
}

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
    message: NUDGE_RESPONSE_MESSAGES.REMINDER_SENT,
    remindNudge: toRemindNudgeResponse(reminder),
  };
}

export function toNudgeLimitInfoResponse(limit: NudgeDailyLimit): NudgeLimitInfo {
  return {
    dailyLimit: limit.dailyLimit,
    usedToday: limit.used,
    remainingToday: limit.remaining,
    isUnlimited: limit.dailyLimit == null,
  };
}

export function toNudgeCooldownResponse(cooldown: SendCooldown): NudgeCooldownInfo {
  return {
    canNudge: !cooldown.isActive,
    cooldownEndsAt: toNullableIsoString(cooldown.endsAt),
    remainingSeconds: cooldown.remainingSeconds > 0 ? cooldown.remainingSeconds : null,
  };
}

export function toMarkNudgeReadResponse(): MarkNudgeReadResponse {
  return { message: NUDGE_RESPONSE_MESSAGES.READ, readCount: 1 };
}
