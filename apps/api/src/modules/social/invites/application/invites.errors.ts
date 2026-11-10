import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteConfigPort } from "./ports/invite-config.port.js";

function inviteDisabled(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2105);
}

/** 플래그가 꺼져 있으면 초대 기능 전체를 INVITE_2105로 막는다. */
export function assertInviteEnabled(config: Pick<InviteConfigPort, "isEnabled">): void {
  if (!config.isEnabled) {
    throw inviteDisabled();
  }
}

export function inviteNotFound(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2101);
}

export function inviteRevoked(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2102);
}

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

export function inviteCodeRetriesExhausted(attempts: number): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "Invite code collision retries exhausted",
    attempts,
  });
}
