import type { ErrorCodeType } from '@aido/api/errors';
import { isErrorCode } from '@aido/api/errors';
import { z } from 'zod';

import { errorEnvelopeSchema } from './error-envelope';

/** 리프레시 거부 판정은 다른 필드가 빠져도 코드만 있으면 읽어야 한다 */
const errorCodeEnvelopeSchema = z.object({
  error: errorEnvelopeSchema.shape.error.pick({ code: true }),
});

/** 401로 뭉개면 SESSION_0704(토큰 재사용 → 패밀리 폐기)와 SESSION_0702(단순 만료)를 구분해 진단할 수 없다 */
export function toServerErrorCode(body: unknown): ErrorCodeType | undefined {
  const parsed = errorCodeEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }

  const { code } = parsed.data.error;
  return isErrorCode(code) ? code : undefined;
}
