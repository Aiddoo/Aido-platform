import type { UserRole } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export abstract class TokenIssuerPort {
  abstract generateTokenPair(
    userId: UserId,
    email: string,
    sessionId: SessionId,
    role: UserRole,
    tokenFamily?: string,
    tokenVersion?: number,
  ): Promise<TokenPair>;
  abstract generateTokenFamily(): string;
  abstract hashRefreshToken(token: string): string;
  abstract getRefreshTokenExpiresInSeconds(): number;
}
