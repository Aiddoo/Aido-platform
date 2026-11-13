import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { InviteConfigPort } from "./ports/invite-config.port.js";

function inviteDisabled(): ApplicationException {
  return new ApplicationException(ErrorCode.INVITE_2105);
}

// 플래그가 꺼져 있으면 초대 기능 전체를 INVITE_2105로 막는다
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

export function inviteCodeRetriesExhausted(attempts: number): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "Invite code collision retries exhausted",
    attempts,
  });
}
