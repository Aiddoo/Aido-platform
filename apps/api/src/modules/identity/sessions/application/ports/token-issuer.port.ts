import type { UserRole } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPairClaims {
  readonly userId: UserId;
  readonly email: string;
  readonly sessionId: SessionId;
  readonly role: UserRole;
  readonly tokenFamily?: string;
  readonly tokenVersion?: number;
}

export abstract class TokenIssuerPort {
  abstract generateTokenPair(claims: TokenPairClaims): Promise<TokenPair>;
  abstract generateTokenFamily(): string;
  abstract hashRefreshToken(token: string): string;
  abstract getRefreshTokenExpiresInSeconds(): number;
}
