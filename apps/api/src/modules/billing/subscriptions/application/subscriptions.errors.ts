import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

/** 웹훅 Authorization이 없거나 다르다. */
export function invalidWebhookSignature(): ApplicationException {
  return new ApplicationException(ErrorCode.SUBSCRIPTION_1601);
}

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

export function isWebhookLockContended(error: unknown): boolean {
  return error instanceof ApplicationException && error.errorCode === ErrorCode.SUBSCRIPTION_1605;
}

/**
 * 다시 보내도 결과가 같아 공급자 재전송이 의미 없는 실패: 사용자·체인·필수 시각이 없는 이벤트다. 그 밖의 실패
 * (DB·외부 호출)는 처리 원장도 함께 롤백되므로 non-2xx로 공급자 재전송에 맡긴다. 체인 ID가 없는 이벤트는
 * StoreSubscriptionId(Domain)가 같은 코드로 거절한다.
 */
export function isPermanentWebhookFailure(error: unknown): boolean {
  return (
    error instanceof ErrorCodedException &&
    (error.errorCode === ErrorCode.SUBSCRIPTION_1602 ||
      error.errorCode === ErrorCode.SUBSCRIPTION_1604)
  );
}
