import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";

/** 플래그가 꺼져 있으면 초대 기능 전체를 INVITE_2105로 막는다. */
export function assertInviteEnabled(config: InviteConfigPort): void {
  if (!config.isEnabled) {
    throw new ApplicationException(ErrorCode.INVITE_2105);
  }
}
