import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 모델이 만들 할 일을 하나도 돌려주지 않았다. 예약을 환불했다 */
export function emptyGeneration(): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1302, { charged: false });
}

/** 환불하지 못해 차감 여부를 보장할 수 없다. details의 charged:false를 떼고 같은 코드로 던진다 */
export function chargeUnconfirmed(rejected: ApplicationException): ApplicationException {
  return new ApplicationException(rejected.errorCode, undefined, { cause: rejected });
}

export function authenticationRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.AUTH_0107);
}

export function aiDataSharingConsentRequired(decision: string): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1311, { decision });
}
