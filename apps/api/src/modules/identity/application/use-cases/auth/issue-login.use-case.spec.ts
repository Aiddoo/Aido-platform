import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import type { IssueLoginInput } from "./issue-login.use-case.js";

describe("IssueLogin — 세션 발급과 로그인 성공 기록", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { provider: "CREDENTIAL", securityMetadata: undefined },
    { provider: "GOOGLE", securityMetadata: { provider: "GOOGLE" } },
  ] satisfies Pick<IssueLoginInput, "provider" | "securityMetadata">[])(
    "$provider 로그인은 실제 발급한 세션·토큰과 성공 기록·프로필을 반환한다",
    async ({ provider, securityMetadata }) => {
      // Given
      const fixture = createAuthCredentialFixture({ socialOnly: provider === "GOOGLE" });
      const input: IssueLoginInput = {
        userId: fixture.user.id,
        email: fixture.user.email,
        role: fixture.user.role,
        provider,
        ip: "192.0.2.1",
        userAgent: "Aido-Test",
        deviceFingerprint: "my-device",
        securityMetadata,
      };

      // When
      const result = await fixture.issueLoginUseCase.execute(input);

      // Then
      expect(fixture.sessionRepository.sessions.get(result.sessionId)).toMatchObject({
        userId: fixture.user.id,
        refreshTokenHash: `digest:${result.tokens.refreshToken}`,
        revokedAt: null,
      });
      expect(fixture.sessionRepository.creations).toEqual([
        expect.objectContaining({
          userId: fixture.user.id,
          deviceFingerprint: input.deviceFingerprint,
          userAgent: input.userAgent,
          ipAddress: input.ip,
        }),
      ]);
      expect(result).toEqual({
        sessionId: result.sessionId,
        tokens: {
          accessToken: `access:${result.sessionId}:1`,
          refreshToken: `refresh:${result.sessionId}:1`,
          expiresIn: 900,
        },
        userTag: fixture.user.userTag,
        name: "사용자",
        profileImage: null,
      });
      expect(fixture.loginAttemptRepository.attempts).toEqual([
        {
          email: input.email,
          provider,
          ipAddress: input.ip,
          userAgent: input.userAgent,
          success: true,
          at: AUTH_CREDENTIAL_TIME,
        },
      ]);
      expect(fixture.securityLogRepository.entries).toStrictEqual([
        {
          userId: input.userId,
          event: "LOGIN_SUCCESS",
          ipAddress: input.ip,
          userAgent: input.userAgent,
          ...(securityMetadata === undefined ? {} : { metadata: securityMetadata }),
        },
      ]);
    },
  );

  it("프로필 조회 결과가 없으면 userTag는 빈 문자열, 이름·이미지는 null로 반환한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    fixture.userRepository.users.clear();

    // When
    const result = await fixture.issueLoginUseCase.execute({
      userId: fixture.user.id,
      email: fixture.user.email,
      role: fixture.user.role,
      provider: "CREDENTIAL",
      ip: "192.0.2.1",
      userAgent: "Aido-Test",
      deviceFingerprint: "my-device",
    });

    // Then
    expect(result).toMatchObject({ userTag: "", name: null, profileImage: null });
    expect(fixture.sessionRepository.sessions.has(result.sessionId)).toBe(true);
  });
});
