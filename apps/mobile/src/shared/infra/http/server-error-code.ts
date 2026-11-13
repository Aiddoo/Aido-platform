import type { ErrorCodeType } from '@aido/api/errors';

import { readErrorEnvelope, toKnownErrorCode } from './error-envelope';

/** 401로 뭉개면 SESSION_0704(토큰 재사용 → 패밀리 폐기)와 SESSION_0702(단순 만료)를 구분해 진단할 수 없다 */
export function toServerErrorCode(body: unknown): ErrorCodeType | undefined {
  return toKnownErrorCode(readErrorEnvelope(body)?.code) ?? undefined;
}
