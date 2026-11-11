import { Errors } from "@aido/api/errors";

import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

const SERVER_ERROR_STATUS = 500;

/**
 * 계약에서 4xx로 정한 업무 거부(불변식 위반·없음·권한·한도)인지. HTTP·웹훅·이벤트·작업 어느 경로에서 나도
 * 버그가 아니라 Sentry 오류로 보내지 않는다. 사람이 봐야 하면 이름 있는 운영 경보를 올린다.
 */
export function isBusinessRejection(error: unknown): boolean {
  if (!(error instanceof ErrorCodedException)) {
    return false;
  }
  // 패키지 버전이 어긋나 코드 정의가 없으면 장애로 본다
  const status: number | undefined = Errors[error.errorCode]?.httpStatus;
  return status != null && status < SERVER_ERROR_STATUS;
}
