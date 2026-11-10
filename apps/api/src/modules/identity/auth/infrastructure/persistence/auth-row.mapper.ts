import type {
  account as accountTable,
  oAuthState as oAuthStateTable,
  session as sessionTable,
  user as userTable,
  verification as verificationTable,
} from "#api/platform/database/schema/index";

import { IdentityUser } from "../../../users/domain/identity-user.aggregate.js";
import type { AuthAccountRecord } from "../../application/ports/auth-account.repository.port.js";
import { AuthOAuthState } from "../../domain/auth-oauth-state.aggregate.js";
import { AuthSession } from "../../domain/auth-session.aggregate.js";
import { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import { IdentityAccounts } from "../../domain/identity-accounts.aggregate.js";

type SessionRow = typeof sessionTable.$inferSelect;
type VerificationRow = typeof verificationTable.$inferSelect;
type OAuthStateRow = typeof oAuthStateTable.$inferSelect;
type UserRow = Pick<
  typeof userTable.$inferSelect,
  | "id"
  | "email"
  | "userTag"
  | "role"
  | "status"
  | "emailVerifiedAt"
  | "subscriptionStatus"
  | "subscriptionExpiresAt"
  | "createdAt"
  | "deletedAt"
>;
type AccountRow = Pick<
  typeof accountTable.$inferSelect,
  "id" | "provider" | "providerAccountId" | "createdAt"
>;

export function toAuthSession(row: SessionRow): AuthSession {
  return AuthSession.reconstitute({
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenHash,
    previousTokenHash: row.previousTokenHash,
    tokenFamily: row.tokenFamily,
    tokenVersion: row.tokenVersion,
    deviceFingerprint: row.deviceFingerprint,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  });
}

export function toAuthVerification(row: VerificationRow): AuthVerification {
  return AuthVerification.reconstitute({
    id: row.id,
    userId: row.userId,
    type: row.type,
    tokenHash: row.token,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  });
}

export function toAuthOAuthState(row: OAuthStateRow): AuthOAuthState {
  return AuthOAuthState.reconstitute({
    id: row.id,
    state: row.state,
    provider: row.provider,
    redirectUri: row.redirectUri,
    mode: row.mode,
    initiatingUserId: row.initiatingUserId,
    exchangeCode: row.exchangeCode,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    userId: row.userId,
    userName: row.userName,
    profileImage: row.profileImage,
    accountRestored: row.accountRestored,
    isNewUser: row.isNewUser,
    expiresAt: row.expiresAt,
    exchangedAt: row.exchangedAt,
  });
}

export function toAuthSessionRow(session: AuthSession): typeof sessionTable.$inferInsert {
  return session.toPrimitives();
}

export function toVerificationRow(
  verification: AuthVerification,
): typeof verificationTable.$inferInsert {
  const { tokenHash, ...primitives } = verification.toPrimitives();
  return { ...primitives, token: tokenHash };
}

export function toIdentityUser(row: UserRow): IdentityUser {
  return IdentityUser.reconstitute({
    id: row.id,
    email: row.email,
    userTag: row.userTag,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    subscriptionStatus: row.subscriptionStatus,
    subscriptionExpiresAt: row.subscriptionExpiresAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  });
}

export function toAuthAccountRecord(
  row: Pick<
    typeof accountTable.$inferSelect,
    "id" | "userId" | "provider" | "providerAccountId" | "password" | "createdAt"
  >,
): AuthAccountRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerAccountId: row.providerAccountId,
    password: row.password,
    createdAt: row.createdAt,
  };
}

export function toIdentityAccounts(userId: string, rows: readonly AccountRow[]): IdentityAccounts {
  return IdentityAccounts.reconstitute({
    userId,
    accounts: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      createdAt: row.createdAt,
    })),
  });
}
