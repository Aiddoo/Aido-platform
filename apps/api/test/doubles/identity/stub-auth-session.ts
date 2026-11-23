import type { UserRole } from "@aido/api/vocabulary";

import type { SessionCachePort } from "#api/modules/identity/sessions/application/ports/session-cache.port";
import type {
  TokenIssuerPort,
  TokenPair,
  TokenPairClaims,
} from "#api/modules/identity/sessions/application/ports/token-issuer.port";
import type { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import type { SessionPushDeviceReleaserPort } from "#api/modules/notification/push-devices/notification-push-devices.public";

export class StubSessionCache implements Pick<
  SessionCachePort,
  "invalidateSession" | "evictSession"
> {
  readonly sessionIds: Set<string>;

  constructor(sessionIds: readonly string[] = []) {
    this.sessionIds = new Set(sessionIds);
  }

  async evictSession(sessionId: SessionId): Promise<void> {
    await this.invalidateSession(sessionId);
  }

  async invalidateSession(sessionId: SessionId): Promise<void> {
    this.sessionIds.delete(sessionId.value);
  }
}

/** 폐기 뒤 푸시 기기 해제를 요청한 세션을 순서대로 기록한다. */
export class StubSessionPushDeviceReleaser implements SessionPushDeviceReleaserPort {
  readonly releasedSessionIds: string[] = [];

  async releaseSessions(sessionIds: readonly SessionId[]): Promise<void> {
    this.releasedSessionIds.push(...sessionIds.map((sessionId) => sessionId.value));
  }
}

export class StubTokenIssuer implements Pick<
  TokenIssuerPort,
  | "generateTokenFamily"
  | "generateTokenPair"
  | "hashRefreshToken"
  | "getRefreshTokenExpiresInSeconds"
> {
  #familyCount = 0;
  readonly issued: {
    userId: string;
    email: string;
    sessionId: string;
    role: UserRole;
    tokenFamily?: string;
    tokenVersion?: number;
  }[] = [];
  readonly refreshTokenExpiresInSeconds = 604_800;

  generateTokenFamily(): string {
    this.#familyCount += 1;
    return `token-family-${this.#familyCount}`;
  }

  async generateTokenPair({
    userId,
    email,
    sessionId,
    role,
    tokenFamily,
    tokenVersion,
  }: TokenPairClaims): Promise<TokenPair> {
    this.issued.push({
      userId: userId.value,
      email,
      sessionId: sessionId.value,
      role,
      tokenFamily,
      tokenVersion,
    });
    return {
      accessToken: `access:${sessionId.value}:${tokenVersion}`,
      refreshToken: `refresh:${sessionId.value}:${tokenVersion}`,
      expiresIn: 900,
    };
  }

  hashRefreshToken(token: string): string {
    return `digest:${token}`;
  }

  getRefreshTokenExpiresInSeconds(): number {
    return this.refreshTokenExpiresInSeconds;
  }
}
