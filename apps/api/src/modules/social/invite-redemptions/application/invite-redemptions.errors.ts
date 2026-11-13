import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export function selfInvite(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2103);
}

export function inviteAlreadyRedeemed(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2104);
}

export function inviteeFriendSlotUnavailable(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2106);
}

// 초대한 사람이 나를 차단했는지 드러내지 않도록 방향 없는 차단 오류로 답한다
export function inviteBlocked(): ApplicationException {
  return new ApplicationException(ErrorCode.BLOCK_2204);
}

export function inviteUserNotFound(userId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0601, { userId: userId.value });
}

// 코드가 없는 실패라 응답이 아니라 큐 backoff 재시도를 부른다. 작업 실패 로그는 이 이름으로 남는다
export class InviteRewardGrantFailedError extends Error {
  readonly failedCount: number;

  constructor(failedCount: number) {
    super(`Invite reward grants failed: ${failedCount}`);
    this.failedCount = failedCount;
    this.name = "InviteRewardGrantFailedError";
  }
}
