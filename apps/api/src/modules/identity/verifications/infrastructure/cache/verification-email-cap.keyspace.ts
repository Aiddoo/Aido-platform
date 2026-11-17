import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

import { VERIFICATION_EMAIL_CAP } from "../../domain/verifications.constants.js";

export const VERIFICATION_EMAIL_CAP_TTL_MS = VERIFICATION_EMAIL_CAP.WINDOW_HOURS * 60 * 60 * 1000;
// 키에 이메일 원문을 두지 않고 소문자 이메일의 SHA-256 hex만 둔다
export const VerificationEmailCapKey = {
  email: (emailDigest: string) => cacheKey("auth", "verification-email-cap", emailDigest),
} as const;
