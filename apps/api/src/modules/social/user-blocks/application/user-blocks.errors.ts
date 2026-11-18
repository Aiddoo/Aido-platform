import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export function blockTargetNotFound(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.BLOCK_2202, { targetUserId: targetUserId.value });
}
