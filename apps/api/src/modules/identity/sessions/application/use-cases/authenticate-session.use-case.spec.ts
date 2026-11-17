import { ErrorCode } from "@aido/api/errors";

import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import type { Session } from "#api/modules/identity/sessions/domain/session.aggregate";
import type { User } from "#api/modules/identity/users/domain/user.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_SESSION_ID,
  AUTH_FIXTURE_USER_ID,
  createSessionFixture,
  createUserFixture,
} from "#test/fixtures/identity/session.fixture";

import type { CachedSession, SessionCachePort } from "../ports/session-cache.port.js";
import { SessionLogEvent } from "../sessions.log-events.js";
import {
  type AccessTokenClaims,
  type AuthenticateSessionDependencies,
  AuthenticateSessionUseCase,
} from "./authenticate-session.use-case.js";

class MemorySessionCache implements Pick<SessionCachePort, "wrapSession"> {
  readonly entries = new Map<string, CachedSession>();
  failRead = false;
  failWrite = false;

  async wrapSession(
    sessionId: SessionId,
    factory: () => Promise<CachedSession>,
  ): Promise<CachedSession> {
    if (this.failRead) {
      throw new Error("redis down");
    }
    const cached = this.entries.get(sessionId.value);
    if (cached != null) {
      return cached;
    }
    const loaded = await factory();
    if (this.failWrite) {
      throw new Error("redis down");
    }
    this.entries.set(sessionId.value, loaded);
    return loaded;
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
    readonly session?: Session | null;
    readonly user?: User | null;
    readonly cache?: MemorySessionCache;
    readonly logger?: SilentLogger;
  } = {},
) {
  // oxlint-disable-next-line aido/no-strict-nullish -- undefined는 기본 픽스처, null은 "없는 세션·사용자" 시나리오다
  const session = params.session === undefined ? createSessionFixture() : params.session;
  // oxlint-disable-next-line aido/no-strict-nullish -- 위와 같다
  const user = params.user === undefined ? createUserFixture() : params.user;
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
      userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
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
      userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
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
      userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
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
      createSessionFixture({ revokedAt: AUTH_FIXTURE_NOW }),
      undefined,
      ErrorCode.SESSION_0703,
    ],
    [
      "만료된 세션",
      createSessionFixture({ expiresAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }) }),
      undefined,
      ErrorCode.SESSION_0702,
    ],
    ["잠긴 사용자", undefined, createUserFixture({ status: "LOCKED" }), ErrorCode.USER_0607],
    [
      "탈퇴 대기 사용자",
      undefined,
      createUserFixture({ deletedAt: AUTH_FIXTURE_NOW }),
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

  it("캐시 읽기가 실패해도 DB로 인증하고 실패는 로그로만 남긴다", async () => {
    // Given
    const cache = new MemorySessionCache();
    cache.failRead = true;
    const logger = new SilentLogger();
    const { useCase, sessionReads } = createUseCase({ cache, logger });

    // When
    const user = await useCase.execute(CLAIMS);

    // Then
    expect(user.userId).toBe(AUTH_FIXTURE_USER_ID);
    expect(sessionReads).toEqual([AUTH_FIXTURE_SESSION_ID]);
    expect(logger.messages).toEqual([
      { event: SessionLogEvent.SESSION_CACHE_READ_FAILED, errorType: "Error" },
    ]);
  });

  it("DB에서 읽은 뒤 캐시 저장이 실패해도 DB를 다시 읽지 않고 인증한다", async () => {
    // Given
    const cache = new MemorySessionCache();
    cache.failWrite = true;
    const logger = new SilentLogger();
    const { useCase, sessionReads } = createUseCase({ cache, logger });

    // When
    const user = await useCase.execute(CLAIMS);

    // Then
    expect(user.userId).toBe(AUTH_FIXTURE_USER_ID);
    expect(sessionReads).toEqual([AUTH_FIXTURE_SESSION_ID]);
    expect(logger.messages).toEqual([
      { event: SessionLogEvent.SESSION_CACHE_WRITE_FAILED, errorType: "Error" },
    ]);
  });

  it.each([
    ["읽기", { failRead: true, failWrite: false }],
    ["저장", { failRead: false, failWrite: true }],
  ])("캐시 %s가 실패해도 폐기된 세션의 401은 삼키지 않는다", async (_case, failures) => {
    // Given
    const cache = new MemorySessionCache();
    cache.failRead = failures.failRead;
    cache.failWrite = failures.failWrite;
    const { useCase } = createUseCase({
      cache,
      session: createSessionFixture({ revokedAt: AUTH_FIXTURE_NOW }),
    });

    // When
    const result = useCase.execute(CLAIMS);

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SESSION_0703 });
  });

  it("DB 읽기 오류는 캐시 장애로 삼키지 않고 그대로 던진다", async () => {
    // Given
    const failure = new Error("database down");
    const logger = new SilentLogger();
    const useCase = new AuthenticateSessionUseCase({
      sessionRepository: {
        findById: async () => {
          throw failure;
        },
      },
      userRepository: { findById: async () => createUserFixture() },
      cache: new MemorySessionCache(),
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      logger,
    });

    // When
    const result = useCase.execute(CLAIMS);

    // Then
    await expect(result).rejects.toBe(failure);
    expect(logger.messages).toEqual([]);
  });
});
