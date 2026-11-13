import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendshipId } from "../domain/friendship-id.vo.js";
import type { FriendFeatureQuota } from "./ports/friend-limit.reader.port.js";

export function cannotFriendSelf(): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0904);
}

export function friendLimitReached(params: {
  readonly friendCount: number;
  readonly maxFriendCount: number | null;
  readonly featureQuota: FriendFeatureQuota;
}): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0909, {
    current: params.friendCount,
    limit: params.maxFriendCount,
    charged: false,
    featureQuota: params.featureQuota,
  });
}

export function friendTargetNotFound(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0905, { targetUserId: targetUserId.value });
}

export function friendTargetTagNotFound(userTag: string): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0905, { userTag });
}

export function blockedTargetRequested(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.BLOCK_2203, { targetUserId: targetUserId.value });
}

export function alreadyFriends(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0902, { targetUserId: targetUserId.value });
}

export function friendRequestAlreadySent(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0901, { targetUserId: targetUserId.value });
}

export function friendRequestNotFound(requesterUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0903, { targetUserId: requesterUserId.value });
}

export function friendshipNotFound(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0907, { targetUserId: targetUserId.value });
}

export function reorderFriendNotFound(friendshipId: FriendshipId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0910, { targetFollowId: friendshipId.value });
}

export function acceptedFriendNotFound(params: {
  readonly friendshipId: FriendshipId;
  readonly userId: UserId;
  readonly requesterUserId: UserId;
}): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "Failed to retrieve created follow with user info",
    context: {
      followId: params.friendshipId.value,
      userId: params.userId.value,
      requesterUserId: params.requesterUserId.value,
    },
  });
}

export function displayNameUserNotFound(userId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "User for display name not found",
    userId: userId.value,
  });
}
