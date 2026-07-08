import type { ErrorCodeType } from '@aido/errors';
import { isErrorCode } from '@aido/errors';
import { z } from 'zod';

/** 서버 에러 envelope(신뢰 불가 입력) — 런타임 검증으로 `as` 캐스트를 피한다. */
const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string() }),
});

/**
 * 서버 에러 응답 본문에서 `ErrorCode`를 뽑는다.
 *
 * 세션이 왜 끝났는지 서버가 아는 경우(리프레시 거부), 그 판정은 서버가 진실의 원천이다.
 * `SESSION_0704`(토큰 재사용 감지 → 패밀리 폐기)와 `SESSION_0702`(단순 만료)는
 * 운영상 완전히 다른 사건이므로, 401 하나로 뭉개면 진단이 불가능해진다.
 *
 * 알 수 없는 코드/비-JSON 본문이면 `undefined`.
 */
export const toServerErrorCode = (body: unknown): ErrorCodeType | undefined => {
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }

  const { code } = parsed.data.error;
  return isErrorCode(code) ? code : undefined;
};
