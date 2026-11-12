import { ErrorCode, HttpStatus } from '@aido/api/errors';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { AfterResponseState } from 'ky';

import { errorEnvelopeSchema } from './error-envelope';
import { REQUEST_ID_HEADER } from './request-headers';
import { getPathname } from './request-path';

/** clone으로 원본 스트림을 보존한다 */
async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

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

/** 관측만 하고 throw하지 않는다. 분류까지 하면 5xx가 비재시도 ApiError로 둔갑하며, 401은 갱신 흐름의 정상 경로라 건너뛴다 */
export function createApiFailureBreadcrumbHook(
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb'>,
) {
  return async ({ request, response }: AfterResponseState): Promise<void> => {
    if (!response.ok && response.status !== HttpStatus.UNAUTHORIZED) {
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
