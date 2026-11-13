import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export function reminderTargetNotFriend(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1103, { targetUserId: targetUserId.value });
}

export function reminderTargetHasTodayTodos(receiverId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1107, { receiverId: receiverId.value });
}

export function reminderNudgeCooldownActive(
  targetUserId: UserId,
  remainingSeconds: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.NUDGE_1108, {
    targetUserId: targetUserId.value,
    remainingSeconds,
  });
}
