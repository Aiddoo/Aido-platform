import { ErrorCode, isErrorCode } from '@aido/errors';
import { t, tDynamic } from '@src/shared/i18n';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import type { AfterResponseHook } from 'ky';
import { z } from 'zod';

/**
 * 실패 응답 관측 훅.
 *
 * **관측만 한다 — 절대 throw하지 않는다.** 에러 분류(4xx→Result.err(ApiError),
 * 5xx→ServerError throw)는 `KyHttpClient`가 단일 소유한다. 훅이 분류까지 하면
 * 책임이 두 곳으로 갈라져 5xx가 비재시도 ApiError로 둔갑하는 버그가 재발한다.
 *
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

export const pathnameOf = (url: string): string => {
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
const recordFailureBreadcrumb = async (request: Request, response: Response): Promise<void> => {
  const parsed = errorEnvelopeSchema.safeParse(await readBody(response));
  const code = parsed.success ? parsed.data.error.code : ErrorCode.SYS_0001;
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

/** auth-client용: 401은 갱신 흐름(token-refresh-hook)의 정상 경로라 소음 방지를 위해 건너뜀 */
export const recordApiFailureBreadcrumb: AfterResponseHook = async (
  request,
  _options,
  response,
) => {
  if (!response.ok && response.status !== 401) {
    await recordFailureBreadcrumb(request, response);
  }
};

/** public-client용: 갱신 흐름이 없으므로 401 포함 모든 실패를 기록 */
export const recordPublicApiFailureBreadcrumb: AfterResponseHook = async (
  request,
  _options,
  response,
) => {
  if (!response.ok) {
    await recordFailureBreadcrumb(request, response);
  }
};
