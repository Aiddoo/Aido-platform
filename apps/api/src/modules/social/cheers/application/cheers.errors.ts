import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CheerId } from "../domain/cheer-id.vo.js";
import type { DailySendFeatureQuota } from "./ports/daily-send-usage.reader.port.js";

export function cannotCheerSelf(): ApplicationException {
  return new ApplicationException(ErrorCode.CHEER_1204);
}

export function cheerTargetNotFriend(targetUserId: UserId): ApplicationException {
  return new ApplicationException(ErrorCode.CHEER_1203, { targetUserId: targetUserId.value });
}

export function cheerDailyLimitReached(featureQuota: DailySendFeatureQuota): ApplicationException {
  return new ApplicationException(ErrorCode.CHEER_1201, { charged: false, featureQuota });
}

export function cheerCooldownActive(
  targetUserId: UserId,
  remainingSeconds: number,
): ApplicationException {
  return new ApplicationException(ErrorCode.CHEER_1202, {
    targetUserId: targetUserId.value,
    remainingSeconds,
  });
}

export function cheerNotFound(cheerId: CheerId): ApplicationException {
  return new ApplicationException(ErrorCode.CHEER_1205, { cheerId: cheerId.value });
}
