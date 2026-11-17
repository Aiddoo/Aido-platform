import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

import {
  VERIFICATION_EMAIL_CAP,
  type VerificationType,
} from "../../domain/verifications.constants.js";

export const VERIFICATION_EMAIL_CAP_TTL_MS = VERIFICATION_EMAIL_CAP.WINDOW_HOURS * 60 * 60 * 1000;
// 키에 이메일·IP 원문을 두지 않고 SHA-256 hex만 둔다. 용도가 키에 있어 용도마다 따로 센다
export const VerificationEmailCapKey = {
  email: (purpose: VerificationType, emailDigest: string) =>
    cacheKey("auth", "verification-email-cap", purpose, "email", emailDigest),
  emailSource: (purpose: VerificationType, emailSourceDigest: string) =>
    cacheKey("auth", "verification-email-cap", purpose, "email-source", emailSourceDigest),
  user: (purpose: VerificationType, userId: string) =>
    cacheKey("auth", "verification-email-cap", purpose, "user", userId),
} as const;
