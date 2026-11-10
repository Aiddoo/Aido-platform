import type {
  account as accountTable,
  oAuthState as oAuthStateTable,
  session as sessionTable,
  user as userTable,
  verification as verificationTable,
} from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { AuthOAuthState } from "../../domain/auth-oauth-state.aggregate.js";
import { AuthSession } from "../../domain/auth-session.aggregate.js";
import { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import { IdentityAccounts } from "../../domain/identity-accounts.aggregate.js";
import { IdentityUser } from "../../domain/identity-user.aggregate.js";

// 인증 테이블은 아직 timestamp(mode: date)라 행의 Date를 여기서 Temporal로 바꾼다
function instantOrNull(date: Date | null): Temporal.Instant | null {
  return date == null ? null : instantFromDate(date);
}

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
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    lastUsedAt: instantFromDate(row.lastUsedAt),
    createdAt: instantFromDate(row.createdAt),
    expiresAt: instantFromDate(row.expiresAt),
    revokedAt: instantOrNull(row.revokedAt),
  });
}

export function toAuthVerification(row: VerificationRow): AuthVerification {
  return AuthVerification.reconstitute({
    id: row.id,
    userId: row.userId,
    type: row.type,
    tokenHash: row.token,
    expiresAt: instantFromDate(row.expiresAt),
    attempts: row.attempts,
    usedAt: instantOrNull(row.usedAt),
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
    expiresAt: instantFromDate(row.expiresAt),
    exchangedAt: instantOrNull(row.exchangedAt),
  });
}

export function toIdentityUser(row: UserRow): IdentityUser {
  return IdentityUser.reconstitute({
    id: row.id,
    email: row.email,
    userTag: row.userTag,
    role: row.role,
    status: row.status,
    emailVerifiedAt: instantOrNull(row.emailVerifiedAt),
    subscriptionStatus: row.subscriptionStatus,
    subscriptionExpiresAt: instantOrNull(row.subscriptionExpiresAt),
    createdAt: instantFromDate(row.createdAt),
    deletedAt: instantOrNull(row.deletedAt),
  });
}

export function toIdentityAccounts(userId: string, rows: readonly AccountRow[]): IdentityAccounts {
  return IdentityAccounts.reconstitute({
    userId,
    accounts: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      createdAt: instantFromDate(row.createdAt),
    })),
  });
}
