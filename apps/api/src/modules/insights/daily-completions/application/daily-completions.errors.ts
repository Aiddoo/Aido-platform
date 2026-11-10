import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export function notMutualFriend(friendUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.FOLLOW_0906, { targetUserId: friendUserId.value });
}
