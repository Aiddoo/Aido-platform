import type {
  BlockedUser,
  BlockedUsersResponse,
  BlockUserResponse,
  UnblockUserResponse,
} from "@aido/api/contracts/user-block";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  BlockedUserListReadModel,
  BlockedUserReadModel,
} from "../../../application/read-models/blocked-user.read-model.js";
import type { UserBlock } from "../../../domain/user-block.aggregate.js";

const USER_BLOCK_RESPONSE_MESSAGES = {
  BLOCKED: "사용자를 차단했습니다.",
  UNBLOCKED: "차단을 해제했습니다.",
} as const;

export function toBlockUserResponse(block: UserBlock): BlockUserResponse {
  return {
    message: USER_BLOCK_RESPONSE_MESSAGES.BLOCKED,
    blockedUserId: block.blockedId.value,
    blockedAt: toIsoString(block.createdAt),
  };
}

export function toUnblockUserResponse(): UnblockUserResponse {
  return { message: USER_BLOCK_RESPONSE_MESSAGES.UNBLOCKED };
}

function toBlockedUserResponse(
  blockedUser: BlockedUserReadModel,
  appVersion: string | undefined,
): BlockedUser {
  return {
    id: blockedUser.userId,
    userTag: blockedUser.userTag,
    name: blockedUser.name,
    profileImage: resolveProfileImage(blockedUser.profileImage, appVersion),
    blockedAt: toIsoString(blockedUser.blockedAt),
  };
}

export function toBlockedUsersResponse(
  list: BlockedUserListReadModel,
  appVersion: string | undefined,
): BlockedUsersResponse {
  return {
    items: list.page.items.map((blockedUser) => toBlockedUserResponse(blockedUser, appVersion)),
    totalCount: list.totalCount,
    hasMore: list.page.pagination.hasNext,
    nextCursor: list.page.pagination.nextCursor,
  };
}
