import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ServerFlagFeature } from "../domain/entitlement.domain-service.js";
import type { EntitlementReaderPort } from "./ports/entitlement.reader.port.js";

/** 기능마다 앱이 이미 분기하는 기존 거부 코드를 그대로 쓴다. */
const DENIED_ERROR_CODE = {
  AI_REPORT: ErrorCode.AI_1308,
  AI_SUGGESTION: ErrorCode.AI_1309,
  CUSTOM_REMINDER_TIME: ErrorCode.PREFERENCE_1701,
} as const satisfies Record<ServerFlagFeature, ErrorCodeType>;

export function premiumFeatureDenied(feature: ServerFlagFeature): ApplicationException {
  return new ApplicationException(DENIED_ERROR_CODE[feature]);
}

/** 쓸 수 없는 기능이면 그 기능의 거부 코드로 던진다. */
export async function assertEntitled(
  entitlements: Pick<EntitlementReaderPort, "can">,
  userId: UserId,
  feature: ServerFlagFeature,
): Promise<void> {
  if (!(await entitlements.can(userId, feature))) {
    throw premiumFeatureDenied(feature);
  }
}

/** 잠금을 잡은 UoW 안에서 최신 상태로 다시 확인한다. */
export async function assertEntitledInTx(
  entitlements: Pick<EntitlementReaderPort, "canInTx">,
  userId: UserId,
  feature: ServerFlagFeature,
): Promise<void> {
  if (!(await entitlements.canInTx(userId, feature))) {
    throw premiumFeatureDenied(feature);
  }
}

/** 사용자 행을 잠그지 못했거나 사용자가 없다. 기존 응답과 같은 USER_0601이다. */
export function accessUserNotFound(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0601, { userId });
}
