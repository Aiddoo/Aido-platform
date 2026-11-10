/**
 * Session 테스트 Fixture
 *
 * 타입 안전한 Session 및 인증 관련 엔티티 테스트 데이터 생성
 */
import type { Session, Verification } from "#test/types/database-rows";

let sessionCounter = 0;
let verificationCounter = 0;

/**
 * Session Fixture 팩토리
 *
 * @example
 * ```typescript
 * // 기본 Session 생성
 * const session = SessionFixture.create({ userId: 'user-1' });
 *
 * // 만료된 Session 생성
 * const expired = SessionFixture.createExpired({ userId: 'user-1' });
 * ```
 */
export const SessionFixture = {
  /**
   * Session 엔티티 생성
   */
  create: (overrides: Partial<Session> = {}): Session => {
    const id = ++sessionCounter;
    const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
    const expiresAt = now.add({ hours: 7 * 24 });

    return {
      id: overrides.id ?? `session-${id}`,
      userId: overrides.userId ?? `user-${id}`,
      refreshTokenHash: overrides.refreshTokenHash ?? `hash-${id}-${now.epochMilliseconds}`,
      tokenFamily: overrides.tokenFamily ?? `family-${id}`,
      tokenVersion: overrides.tokenVersion ?? 1,
      previousTokenHash: overrides.previousTokenHash ?? null,
      deviceFingerprint: overrides.deviceFingerprint ?? `fingerprint-${id}`,
      userAgent: overrides.userAgent ?? "Mozilla/5.0 (Test)",
      ipAddress: overrides.ipAddress ?? "127.0.0.1",
      expiresAt: overrides.expiresAt ?? expiresAt,
      revokedAt: overrides.revokedAt ?? null,
      revokedReason: overrides.revokedReason ?? null,
      lastUsedAt: overrides.lastUsedAt ?? now,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
  },

  /**
   * 만료된 Session 생성
   */
  createExpired: (overrides: Partial<Session> = {}): Session => {
    return SessionFixture.create({
      expiresAt: Temporal.Instant.fromEpochMilliseconds(Date.now()).subtract({ hours: 24 }),
      ...overrides,
    });
  },

  /**
   * 취소된 Session 생성
   */
  createRevoked: (overrides: Partial<Session> = {}): Session => {
    return SessionFixture.create({
      revokedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      revokedReason: "USER_LOGOUT",
      ...overrides,
    });
  },

  /**
   * 여러 Session 생성
   */
  createMany: (count: number, overrides: Partial<Session> = {}): Session[] => {
    return Array.from({ length: count }, () => SessionFixture.create(overrides));
  },

  /**
   * 카운터 리셋
   */
  reset: (): void => {
    sessionCounter = 0;
  },
};

/**
 * Verification Fixture 팩토리
 */
export const VerificationFixture = {
  create: (overrides: Partial<Verification> = {}): Verification => {
    const id = ++verificationCounter;
    const now = Temporal.Instant.fromEpochMilliseconds(Date.now());

    return {
      id: overrides.id ?? id,
      userId: overrides.userId ?? `user-${id}`,
      type: overrides.type ?? "EMAIL_VERIFY",
      token: overrides.token ?? `token-${id}-${now.epochMilliseconds}`,
      expiresAt: overrides.expiresAt ?? now.add({ minutes: 10 }),
      usedAt: overrides.usedAt ?? null,
      attempts: overrides.attempts ?? 0,
      createdAt: overrides.createdAt ?? now,
    };
  },

  reset: (): void => {
    verificationCounter = 0;
  },
};
