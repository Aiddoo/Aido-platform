import { ErrorCode } from '@aido/api/errors';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { AfterResponseState } from 'ky';

import { errorEnvelopeSchema } from './error-envelope';
import { REQUEST_ID_HEADER } from './request-headers';
import { getPathname } from './request-path';

/** 응답 본문을 안전하게 JSON으로 읽는다(비-JSON/빈 본문이면 null). clone으로 원본 스트림 보존. */
async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

/**
 * 실패한 API 응답을 Sentry breadcrumb(category: 'http')로 남긴다.
 * 이후 발생하는 에러 이벤트의 타임라인에 "어떤 요청이 어떤 코드로 실패했는지"가 붙는다.
 * 요청 ID로 같은 요청의 서버 로그(`reqId`)·Sentry 이벤트(`request_id`)를 찾는다.
 */
async function recordFailureBreadcrumb(
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb'>,
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = errorEnvelopeSchema.safeParse(await readBody(response));
  const code = parsed.success ? parsed.data.error.code : ErrorCode.SYS_0001;
  errorReporter.addBreadcrumb({
    category: 'http',
    level: 'warning',
    message: 'API 요청 실패',
    data: {
      method: request.method,
      path: getPathname(request.url),
      status: response.status,
      code,
      requestId: request.headers.get(REQUEST_ID_HEADER),
    },
  });
}

/**
 * 실패 응답 관측 훅. auth-client용이라 401은 갱신 흐름(token-refresh-hook)의 정상 경로로 보고 건너뛴다.
 *
 * **관측만 한다 — 절대 throw하지 않는다.** 에러 분류(4xx→Result.err(ApiError),
 * 5xx→ServerError throw)는 `KyHttpClient`가 단일 소유한다. 훅이 분류까지 하면
 * 책임이 두 곳으로 갈라져 5xx가 비재시도 ApiError로 둔갑하는 버그가 재발한다.
 */
export function createApiFailureBreadcrumbHook(
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb'>,
) {
  return async ({ request, response }: AfterResponseState): Promise<void> => {
    if (!response.ok && response.status !== 401) {
      await recordFailureBreadcrumb(errorReporter, request, response);
    }
  };
}

/** public-client용: 갱신 흐름이 없으므로 401 포함 모든 실패를 기록 */
export function createPublicApiFailureBreadcrumbHook(
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb'>,
) {
  return async ({ request, response }: AfterResponseState): Promise<void> => {
    if (!response.ok) {
      await recordFailureBreadcrumb(errorReporter, request, response);
    }
  };
}
