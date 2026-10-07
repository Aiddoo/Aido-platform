import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { GetCurrentUser } from "./get-current-user.use-case.js";

describe("GetCurrentUser — 현재 사용자 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new GetCurrentUser({
      userRepository: fixture.userRepository,
      cacheService: fixture.cacheService,
    });
    return { ...fixture, useCase };
  }

  it("nullable 프로필과 여러 provider를 보존하며 요청별 sessionId는 캐시하지 않는다", async () => {
    // Given
    const fixture = given({ pending: true });
    fixture.userRepository.profiles.set(fixture.user.id, { name: null, profileImage: null });
    fixture.userRepository.providers.set(fixture.user.id, [
      { provider: "CREDENTIAL" },
      { provider: "GOOGLE" },
    ]);
    // When
    const first = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
    });
    fixture.userRepository.users.delete(fixture.user.id);
    const second = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-2",
    });
    // Then
    expect(first).toMatchObject({
      userId: fixture.user.id,
      email: fixture.user.email,
      emailVerifiedAt: null,
      name: null,
      profileImage: null,
      providers: ["CREDENTIAL", "GOOGLE"],
      sessionId: "session-1",
    });
    expect(second).toEqual({ ...first, sessionId: "session-2" });
    expect(fixture.userRepository.users.size).toBe(0);
  });

  it("없는 사용자는 USER_0601이며 실패 결과를 프로필 캐시에 저장하지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });
    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, sessionId: "session-1" });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0601,
      details: { userId: fixture.user.id },
    });
    expect(fixture.cacheService.profiles.size).toBe(0);
  });
});
