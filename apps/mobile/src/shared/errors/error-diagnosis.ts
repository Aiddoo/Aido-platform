import { isApiError } from '@src/core/errors/api-error';

import { BusinessError } from './business-error';
import { ServerError } from './infra-error';

export interface ErrorDiagnosis {
  /** 서버 `ErrorCode`나 앱 오류 코드 */
  code: string | null;
  status: number | null;
  /** 같은 요청의 서버 로그·Sentry 이벤트를 찾는 `X-Request-Id` */
  requestId: string | null;
}

/** 사용자 문구·개인정보 없이 원인을 찾을 값만 꺼낸다. 경계의 breadcrumb와 문의 초안이 쓴다 */
export function getErrorDiagnosis(error: unknown): ErrorDiagnosis {
  if (isApiError(error)) {
    return { code: error.code, status: error.status, requestId: error.requestId };
  }
  if (error instanceof ServerError) {
    return { code: error.serverCode, status: error.status, requestId: error.requestId };
  }
  if (error instanceof BusinessError) {
    return { code: error.code, status: null, requestId: null };
  }
  return { code: null, status: null, requestId: null };
}
