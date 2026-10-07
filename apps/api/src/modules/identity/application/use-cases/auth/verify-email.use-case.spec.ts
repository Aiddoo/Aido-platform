import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { VerifyEmail } from "./verify-email.use-case.js";

describe("VerifyEmail — 이메일 인증과 첫 세션 발급", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new VerifyEmail({
      userRepository: fixture.userRepository,
      verificationService: fixture.verificationService,
      retentionEnroller: fixture.retentionEnroller,
      sessionService: fixture.sessionService,
      securityLogRepository: fixture.securityLogRepository,
      unitOfWork: fixture.unitOfWork,
      logger: fixture.logger,
    });
    return { ...fixture, useCase };
  }

  async function givenCode() {
    const fixture = given({ pending: true });
    await fixture.verificationService.createEmailVerification(fixture.user.id);
    return fixture;
  }

  it("올바른 코드를 소비하고 계정을 활성화하며 첫 세션·프로필을 반환한다", async () => {
    // Given
    const fixture = await givenCode();
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test" };
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      code: "123456",
      metadata,
    });
    // Then
    expect(fixture.userRepository.users.get(fixture.user.id)).toMatchObject({
      status: "ACTIVE",
      emailVerifiedAt: AUTH_CREDENTIAL_TIME,
    });
    expect([...fixture.verificationRepository.verifications.values()][0]?.usedAt).toEqual(
      AUTH_CREDENTIAL_TIME,
    );
    expect(fixture.sessionRepository.creations).toEqual([
      expect.objectContaining({
        userId: fixture.user.id,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        deviceFingerprint: metadata.userAgent,
      }),
    ]);
    expect(result).toMatchObject({
      userId: fixture.user.id,
      userTag: fixture.user.userTag,
      name: "사용자",
      profileImage: null,
      tokens: { expiresIn: 900 },
    });
    expect(fixture.retentionEnroller.activatedUserIds).toEqual([fixture.user.id]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: "EMAIL_VERIFIED",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it("틀린 코드면 활성화·세션 발급 없이 실패 횟수만 증가한다", async () => {
    // Given
    const fixture = await givenCode();
    // When
    const pending = fixture.useCase.execute({ email: fixture.user.email, code: "999999" });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(fixture.userRepository.users.get(fixture.user.id)?.status).toBe("PENDING_VERIFY");
    expect([...fixture.verificationRepository.verifications.values()][0]).toMatchObject({
      attempts: 1,
      usedAt: null,
    });
    expect(fixture.sessionRepository.sessions.size).toBe(0);
    expect(fixture.retentionEnroller.activatedUserIds).toEqual([]);
  });

  it.each(["missing", "verified", "deleted"] as const)(
    "%s 계정은 인증 처리 전에 정확한 오류로 거부한다",
    async (state) => {
      // Given
      const fixture = given({ pending: state !== "verified", empty: state === "missing" });
      if (state === "deleted")
        await fixture.userRepository.softDelete(fixture.user.id, AUTH_CREDENTIAL_TIME);
      const expected =
        state === "missing"
          ? ErrorCode.EMAIL_0502
          : state === "verified"
            ? ErrorCode.USER_0604
            : ErrorCode.USER_0606;
      // When
      const pending = fixture.useCase.execute({ email: fixture.user.email, code: "123456" });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: expected });
      expect(fixture.sessionRepository.sessions.size).toBe(0);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );
});
