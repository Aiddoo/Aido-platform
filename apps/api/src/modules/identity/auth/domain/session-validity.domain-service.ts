import type { SESSION_VALIDITIES } from "./auth.constants.js";

export type SessionValidity = (typeof SESSION_VALIDITIES)[number];

export function getSessionValidity(params: {
  readonly expiresAt: Temporal.Instant;
  readonly revokedAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
}): SessionValidity {
  if (params.revokedAt != null) {
    return "revoked";
  }
  return Temporal.Instant.compare(params.expiresAt, params.now) < 0 ? "expired" : "valid";
}
