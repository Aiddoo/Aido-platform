import { errorEnvelopeSchema } from '@aido/api/common';
import { type ErrorCodeType, isErrorCode } from '@aido/api/errors';
import { z } from 'zod';

// 게이트웨이·프록시가 만든 응답은 success·timestamp·message가 빠질 수 있어 code만 있으면 읽는다
const failureBodySchema = z.object({
  error: errorEnvelopeSchema.shape.error.partial({ message: true }),
});

const detailsSchema = z.record(z.string(), z.unknown());

export interface ServerFailure {
  /** 서버가 보낸 코드 그대로다. 앱이 모르는 새 코드일 수 있다 */
  code: string;
  /** 서버가 요청 언어로 번역한 문구 */
  message: string | null;
  details: Record<string, unknown> | null;
}

/** 실패 응답 본문(`@aido/api/common`의 `errorEnvelopeSchema`)을 읽는 유일한 곳. 봉투가 아니면 null이다 */
export function readErrorEnvelope(body: unknown): ServerFailure | null {
  const parsed = failureBodySchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }

  const { code, message, details } = parsed.data.error;
  const record = detailsSchema.safeParse(details);
  return { code, message: message ?? null, details: record.success ? record.data : null };
}

/** 앱이 아는 `ErrorCode`면 그 코드를, 아니면 null을 돌려준다 */
export function toKnownErrorCode(code: string | undefined): ErrorCodeType | null {
  return code != null && isErrorCode(code) ? code : null;
}
