import { ErrorCode, isErrorCode } from '@aido/errors';
import { ApiError } from '@src/shared/errors';
import { t, tDynamic } from '@src/shared/i18n';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import type { AfterResponseHook } from 'ky';
import { z } from 'zod';

/**
 * 코드별 사용자 문구는 i18n 'errors' 네임스페이스에 있다
 * (locales/{ko,en}/errors.json — 키는 ErrorCode 그대로, 보안 마스킹 그룹은 동일 문구 유지).
 */

/** 서버 에러 envelope(신뢰 불가 입력)를 런타임 검증 — `as` 캐스트 없이 타입 확정. */
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const pathnameOf = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/** 응답 본문을 안전하게 JSON으로 읽는다(비-JSON/빈 본문이면 null). clone으로 원본 스트림 보존. */
const readBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

/** code가 알려진 ErrorCode면 로케일 문구를, 아니면 서버 메시지/폴백을 사용(무캐스트, isErrorCode 가드). */
export const resolveMessage = (code: string, serverMessage: string): string => {
  if (isErrorCode(code)) {
    const mapped = tDynamic('errors', code);
    if (mapped) {
      return mapped;
    }
  }
  return serverMessage || t('errors:fallback');
};

/**
 * 실패한 API 응답을 Sentry breadcrumb(category: 'http')로 남긴다.
 * 이후 발생하는 에러 이벤트의 타임라인에 "어떤 요청이 어떤 코드로 실패했는지"가 붙는다.
 */
const breadcrumbFailure = (request: Request, response: Response, code: string): void => {
  errorReporter.addBreadcrumb({
    category: 'http',
    level: 'warning',
    message: 'API 요청 실패',
    data: {
      method: request.method,
      path: pathnameOf(request.url),
      status: response.status,
      code,
    },
  });
};

const toApiError = async (request: Request, response: Response): Promise<ApiError> => {
  const parsed = errorEnvelopeSchema.safeParse(await readBody(response));
  const code = parsed.success ? parsed.data.error.code : ErrorCode.SYS_0001;
  const serverMessage = parsed.success ? parsed.data.error.message : '';
  breadcrumbFailure(request, response, code);
  return new ApiError(code, resolveMessage(code, serverMessage), response.status);
};

/** auth-client용: 401은 refresh 로직에서 처리하므로 건너뜀 */
export const handleApiErrors: AfterResponseHook = async (request, _options, response) => {
  if (!response.ok && response.status !== 401) {
    throw await toApiError(request, response);
  }
};

/** public-client용: 401 포함 모든 에러 처리 */
export const handlePublicApiErrors: AfterResponseHook = async (request, _options, response) => {
  if (!response.ok) {
    throw await toApiError(request, response);
  }
};
