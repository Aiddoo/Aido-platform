export type SessionValidity = "valid" | "revoked" | "expired";

export function getSessionValidity(
  session: { expiresAt: Date; revokedAt: Date | null },
  at: Date,
): SessionValidity {
  if (session.revokedAt !== null) return "revoked";
  return session.expiresAt.getTime() < at.getTime() ? "expired" : "valid";
}
