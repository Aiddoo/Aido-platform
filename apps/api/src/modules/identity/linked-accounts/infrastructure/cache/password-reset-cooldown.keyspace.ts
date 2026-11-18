import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const PASSWORD_RESET_COOLDOWN_TTL_MS = VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS * 1000;
// 키에 이메일 원문을 두지 않고 소문자 이메일의 SHA-256 hex만 둔다
export const PasswordResetCooldownKey = {
  email: (emailDigest: string) => cacheKey("auth", "password-reset-cooldown", emailDigest),
} as const;
