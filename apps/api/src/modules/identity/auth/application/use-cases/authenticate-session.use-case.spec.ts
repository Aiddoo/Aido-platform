import { ErrorCode } from "@aido/api/errors";

import type { AuthSession } from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { SessionId } from "#api/modules/identity/auth/domain/session-id.vo";
import type { IdentityUser } from "#api/modules/identity/users/domain/identity-user.aggregate";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_SESSION_ID,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachedSession, AuthCachePort } from "../ports/auth-collaboration.port.js";
import {
  type AccessTokenClaims,
  type AuthenticateSessionDependencies,
  AuthenticateSessionUseCase,
} from "./authenticate-session.use-case.js";

class MemorySessionCache implements Pick<AuthCachePort, "getSession" | "setSession"> {
  readonly entries = new Map<string, AuthCachedSession>();
  failRead = false;
  failWrite = false;

  async getSession(sessionId: SessionId): Promise<AuthCachedSession | undefined> {
    if (this.failRead) {
      throw new Error("redis down");
    }
    return this.entries.get(sessionId.value);
  }

  async setSession(sessionId: SessionId, session: AuthCachedSession): Promise<void> {
    if (this.failWrite) {
      throw new Error("redis down");
    }
    this.entries.set(sessionId.value, session);
  }
}

const CLAIMS: AccessTokenClaims = {
  sub: AUTH_FIXTURE_USER_ID,
  email: "user@example.com",
  role: "USER",
  type: "access",
  sessionId: AUTH_FIXTURE_SESSION_ID,
};

function createUseCase(
  params: {
    readonly session?: AuthSession | null;
    readonly user?: IdentityUser | null;
    readonly cache?: MemorySessionCache;
    readonly logger?: SilentLogger;
  } = {},
) {
  // oxlint-disable-next-line aido/no-strict-nullish -- undefined는 기본 픽스처, null은 "없는 세션·사용자" 시나리오다
  const session = params.session === undefined ? createAuthSessionFixture() : params.session;
  // oxlint-disable-next-line aido/no-strict-nullish -- 위와 같다
  const user = params.user === undefined ? createIdentityUserFixture() : params.user;
  const sessionReads: string[] = [];
  const dependencies: AuthenticateSessionDependencies = {
    sessionRepository: {
      findById: async (sessionId) => {
        sessionReads.push(sessionId.value);
        return session;
      },
    },
    userRepository: { findById: async () => user },
    cache: params.cache ?? new MemorySessionCache(),
    clock: new FixedClock(AUTH_FIXTURE_NOW),
    logger: params.logger ?? new SilentLogger(),
  };
  return { useCase: new AuthenticateSessionUseCase(dependencies), sessionReads };
}

describe("AuthenticateSessionUseCase — access 토큰의 세션 확인", () => {
  it("유효한 세션이면 토큰의 사용자를 돌려주고 세션·사용자 상태를 30초 캐시에 둔다", async () => {
    // Given
    const cache = new MemorySessionCache();
    const { useCase } = createUseCase({ cache });

    // When
    const user = await useCase.execute(CLAIMS);

    // Then
    expect(user).toEqual({
      userId: AUTH_FIXTURE_USER_ID,
      email: "user@example.com",
      sessionId: AUTH_FIXTURE_SESSION_ID,
      role: "USER",
    });
    expect(cache.entries.get(AUTH_FIXTURE_SESSION_ID)).toEqual({
      userId: AUTH_FIXTURE_USER_ID,
      expiresAt: "2026-11-17T00:00:00.000Z",
      revokedAt: null,
      userStatus: "ACTIVE",
      userDeletedAt: null,
    });
  });

  it("캐시에 있으면 DB를 읽지 않는다(배포 전 Date로 남은 캐시 값도 읽는다)", async () => {
    // Given
    const cache = new MemorySessionCache();
    cache.entries.set(AUTH_FIXTURE_SESSION_ID, {
      userId: AUTH_FIXTURE_USER_ID,
      expiresAt: new Date("2026-11-17T00:00:00.000Z"),
      revokedAt: null,
      userStatus: "ACTIVE",
    });
    const { useCase, sessionReads } = createUseCase({ cache });

    // When
    await useCase.execute(CLAIMS);

    // Then
    expect(sessionReads).toEqual([]);
  });

  it.each([
    ["캐시의 폐기된 세션", { revokedAt: "2026-11-09T00:00:00.000Z" }, ErrorCode.SESSION_0703],
    ["캐시의 만료된 세션", { expiresAt: "2026-11-09T23:59:59.999Z" }, ErrorCode.SESSION_0702],
    ["캐시의 잠긴 사용자", { userStatus: "LOCKED" }, ErrorCode.USER_0607],
    ["캐시의 정지된 사용자", { userStatus: "SUSPENDED" }, ErrorCode.USER_0605],
    ["캐시의 탈퇴 대기 사용자", { userDeletedAt: "2026-11-01T00:00:00.000Z" }, ErrorCode.USER_0605],
  ])("%s는 거절한다", async (_case, overrides, errorCode) => {
    // Given
    const cache = new MemorySessionCache();
    cache.entries.set(AUTH_FIXTURE_SESSION_ID, {
      userId: AUTH_FIXTURE_USER_ID,
      expiresAt: "2026-11-17T00:00:00.000Z",
      revokedAt: null,
      userStatus: "ACTIVE",
      userDeletedAt: null,
      ...overrides,
    });
    const { useCase } = createUseCase({ cache });

    // When
    const result = useCase.execute(CLAIMS);

    // Then
    await expect(result).rejects.toMatchObject({ errorCode });
  });

  it.each([
    ["DB에 없는 세션", null, undefined, ErrorCode.SESSION_0701],
    [
      "폐기된 세션",
      createAuthSessionFixture({ revokedAt: AUTH_FIXTURE_NOW }),
      undefined,
      ErrorCode.SESSION_0703,
    ],
    [
      "만료된 세션",
      createAuthSessionFixture({ expiresAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }) }),
      undefined,
      ErrorCode.SESSION_0702,
    ],
    [
      "잠긴 사용자",
      undefined,
      createIdentityUserFixture({ status: "LOCKED" }),
      ErrorCode.USER_0607,
    ],
    [
      "탈퇴 대기 사용자",
      undefined,
      createIdentityUserFixture({ deletedAt: AUTH_FIXTURE_NOW }),
      ErrorCode.USER_0605,
    ],
  ])(
    "캐시가 비었을 때 %s는 거절하고 캐시에 두지 않는다",
    async (_case, session, user, errorCode) => {
      // Given
      const cache = new MemorySessionCache();
      const { useCase } = createUseCase({ cache, session, user });

      // When
      const result = useCase.execute(CLAIMS);

      // Then
      await expect(result).rejects.toMatchObject({ errorCode });
      expect(cache.entries.size).toBe(0);
    },
  );

  it.each([
    ["access가 아닌 토큰", { type: "refresh" }],
    ["세션 id가 없는 토큰", { sessionId: undefined }],
  ])("%s는 AUTH_0101이다", async (_case, overrides) => {
    // Given
    const { useCase } = createUseCase();

    // When
    const result = useCase.execute({ ...CLAIMS, ...overrides });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.AUTH_0101 });
  });

  it("캐시 읽기·쓰기가 실패해도 DB로 인증하고 실패는 로그로만 남긴다", async () => {
    // Given
    const cache = new MemorySessionCache();
    cache.failRead = true;
    cache.failWrite = true;
    const logger = new SilentLogger();
    const { useCase, sessionReads } = createUseCase({ cache, logger });

    // When
    const user = await useCase.execute(CLAIMS);

    // Then
    expect(user.userId).toBe(AUTH_FIXTURE_USER_ID);
    expect(sessionReads).toEqual([AUTH_FIXTURE_SESSION_ID]);
    expect(logger.messages).toEqual([
      { event: AuthLogEvent.SESSION_CACHE_READ_FAILED, errorType: "Error" },
      { event: AuthLogEvent.SESSION_CACHE_WRITE_FAILED, errorType: "Error" },
    ]);
  });

  it("캐시가 실패해도 폐기된 세션의 401은 삼키지 않는다", async () => {
    // Given
    const cache = new MemorySessionCache();
    cache.failRead = true;
    const { useCase } = createUseCase({
      cache,
      session: createAuthSessionFixture({ revokedAt: AUTH_FIXTURE_NOW }),
    });

    // When
    const result = useCase.execute(CLAIMS);

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SESSION_0703 });
  });
});
