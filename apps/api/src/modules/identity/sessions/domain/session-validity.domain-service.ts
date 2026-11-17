import { isExpiredAt } from "../../shared/domain/expiry.domain-service.js";
import type { SESSION_VALIDITIES } from "./sessions.constants.js";

export type SessionValidity = (typeof SESSION_VALIDITIES)[number];

export function getSessionValidity(params: {
  readonly expiresAt: Temporal.Instant;
  readonly revokedAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
}): SessionValidity {
  if (params.revokedAt != null) {
    return "revoked";
  }
  return isExpiredAt(params.expiresAt, params.now) ? "expired" : "valid";
}
