import type {
  Cheer as CheerResponse,
  CheerCooldownInfo,
  CheerDetail,
  CheerLimitInfo,
  CreateCheerResponse,
  MarkCheerReadResponse,
  ReceivedCheersResponse,
  SentCheersResponse,
} from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { SendCooldown } from "../../../../shared/domain/send-cooldown.domain-service.js";
import type {
  CheerDailyLimitReadModel,
  CheerReadModel,
  ReceivedCheersReadModel,
  SentCheersReadModel,
} from "../../../application/read-models/cheer.read-model.js";
import type { Cheer } from "../../../domain/cheer.aggregate.js";

const CHEER_RESPONSE_MESSAGES = {
  SENT: "응원을 보냈어요! 🎉",
  READ: "확인했습니다.",
} as const;

function toNullableIsoString(instant: Temporal.Instant | null): string | null {
  return instant == null ? null : toIsoString(instant);
}

function toCheerResponse(cheer: Cheer): CheerResponse {
  const primitives = cheer.toPrimitives();
  return {
    id: primitives.id,
    senderId: primitives.senderId,
    receiverId: primitives.receiverId,
    message: primitives.message,
    createdAt: toIsoString(primitives.createdAt),
    readAt: toNullableIsoString(primitives.readAt),
  };
}

export function toCreateCheerResponse(cheer: Cheer): CreateCheerResponse {
  return { message: CHEER_RESPONSE_MESSAGES.SENT, cheer: toCheerResponse(cheer) };
}

function toCheerDetailResponse(cheer: CheerReadModel, appVersion?: string): CheerDetail {
  return {
    id: cheer.id,
    senderId: cheer.senderId,
    receiverId: cheer.receiverId,
    message: cheer.message,
    createdAt: toIsoString(cheer.createdAt),
    readAt: toNullableIsoString(cheer.readAt),
    sender: {
      id: cheer.sender.id,
      userTag: cheer.sender.userTag,
      name: cheer.sender.name,
      profileImage: resolveProfileImage(cheer.sender.profileImage, appVersion),
    },
  };
}

export function toReceivedCheersResponse(
  received: ReceivedCheersReadModel,
  appVersion?: string,
): ReceivedCheersResponse {
  return {
    cheers: received.page.items.map((cheer) => toCheerDetailResponse(cheer, appVersion)),
    totalCount: received.totalCount,
    unreadCount: received.unreadCount,
    hasMore: received.page.pagination.hasNext,
  };
}

export function toSentCheersResponse(
  sent: SentCheersReadModel,
  appVersion?: string,
): SentCheersResponse {
  return {
    cheers: sent.page.items.map((cheer) => toCheerDetailResponse(cheer, appVersion)),
    totalCount: sent.totalCount,
    hasMore: sent.page.pagination.hasNext,
  };
}

export function toCheerLimitInfoResponse(limit: CheerDailyLimitReadModel): CheerLimitInfo {
  return {
    dailyLimit: limit.dailyLimit,
    usedToday: limit.used,
    remainingToday: limit.remaining,
    isUnlimited: limit.dailyLimit == null,
  };
}

export function toCheerCooldownResponse(
  targetUserId: string,
  cooldown: SendCooldown,
): CheerCooldownInfo {
  return {
    userId: targetUserId,
    canCheer: !cooldown.isActive,
    remainingSeconds: cooldown.remainingSeconds,
    cooldownEndsAt: toNullableIsoString(cooldown.endsAt),
  };
}

export function toMarkCheerReadResponse(): MarkCheerReadResponse {
  return { message: CHEER_RESPONSE_MESSAGES.READ, readCount: 1 };
}

export function toMarkManyCheersReadResponse(readCount: number): MarkCheerReadResponse {
  return { message: `${readCount}개의 응원을 확인했습니다.`, readCount };
}
