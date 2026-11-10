import type { UserRole } from "@aido/api/vocabulary";

export abstract class AuthPasswordHasherPort {
  abstract hash(password: string): Promise<string>;
  abstract verify(hash: string, password: string): Promise<boolean>;
  abstract needsRehash(hash: string): boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export abstract class AuthTokenIssuerPort {
  abstract generateTokenPair(
    userId: string,
    email: string,
    sessionId: string,
    role: UserRole,
    tokenFamily?: string,
    tokenVersion?: number,
  ): Promise<TokenPair>;
  abstract generateTokenFamily(): string;
  abstract hashRefreshToken(token: string): string;
  abstract getRefreshTokenExpiresInSeconds(): number;
}
