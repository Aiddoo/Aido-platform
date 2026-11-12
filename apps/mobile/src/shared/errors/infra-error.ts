import { AppError, type AppErrorOptions } from '@src/core/errors/app-error';
import { t } from '@src/shared/i18n';

/** 5xx·네트워크·타임아웃·응답 파싱 실패. 화면이 따로 분기하지 않고 조회는 경계, mutation은 전역 피드백이 받는다 */
export abstract class InfraError extends AppError {}

export class NetworkError extends InfraError {
  override readonly name = 'NetworkError';

  constructor(options?: AppErrorOptions) {
    super(t('common:infraErrors.network'), options);
  }
}

/** 응답이 오지 않았다. 서버가 준 상태가 없어 `status`도 없다 */
export class TimeoutError extends InfraError {
  override readonly name = 'TimeoutError';

  constructor(options?: AppErrorOptions) {
    super(t('common:infraErrors.timeout'), options);
  }
}

interface FailedRequest {
  method: string;
  /** 쿼리를 뺀 경로 */
  endpoint: string;
}

interface ServerErrorSource {
  /** 같은 요청의 서버 로그·Sentry 이벤트를 찾는 `X-Request-Id` */
  requestId: string | null;
  /** 실패한 요청. 보고에 어느 API인지 태그로 남긴다 */
  request: FailedRequest | null;
}

export class ServerError extends InfraError {
  override readonly name = 'ServerError';
  readonly status: number;
  readonly requestId: string | null;
  readonly request: FailedRequest | null;

  constructor(
    status: number,
    { requestId, request }: ServerErrorSource = { requestId: null, request: null },
    options?: AppErrorOptions,
  ) {
    super(t('common:infraErrors.server'), options);
    this.status = status;
    this.requestId = requestId;
    this.request = request;
  }
}

/** 응답이 계약과 다르다. message는 개발용이라 `getUserFacingMessage`가 걸러 낸다 */
export class ParseError extends InfraError {
  override readonly name = 'ParseError';

  constructor(message = t('common:infraErrors.invalidResponse'), options?: AppErrorOptions) {
    super(message, options);
  }
}

export function isInfraError(error: unknown): error is InfraError {
  return error instanceof InfraError;
}

/** 연결이 끊겼거나 응답이 오지 않은 오류. 기기 상태라 예외 리포트 대신 경고로 남긴다 */
export function isConnectivityError(error: unknown): error is NetworkError | TimeoutError {
  return error instanceof NetworkError || error instanceof TimeoutError;
}

/** 다시 보내면 풀릴 수 있는 전송 실패(연결·시간 초과·5xx). 서버 재시작·배포 구간을 재시도로 넘긴다 */
export function isTransientError(
  error: unknown,
): error is NetworkError | TimeoutError | ServerError {
  return isConnectivityError(error) || error instanceof ServerError;
}
