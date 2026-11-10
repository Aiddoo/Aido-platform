import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 웹훅의 앱 사용자 ID로 우리 사용자를 찾지 못했다. 다시 보내도 같아 받은 것으로 닫는다. */
export function subscriptionUserNotFound(appUserId: string): ApplicationException {
  return new ApplicationException(ErrorCode.SUBSCRIPTION_1602, { appUserId });
}

/** 같은 사용자의 웹훅이 이미 처리 중이다. 429로 돌려 공급자가 다시 보내게 한다. */
export function subscriptionWebhookLockContended(appUserId: string): ApplicationException {
  return new ApplicationException(ErrorCode.SUBSCRIPTION_1605, { appUserId });
}

/** 처리할 체인이나 필수 시각이 없다. 다시 보내도 같아 받은 것으로 닫는다. */
export function subscriptionChainUnresolved(details: {
  readonly reason: string;
  readonly eventType?: string;
}): ApplicationException {
  return new ApplicationException(ErrorCode.SUBSCRIPTION_1604, details);
}
