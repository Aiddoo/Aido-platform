import { ErrorCode } from "@aido/api/errors";

import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createIdentityUserFixture } from "#test/fixtures/identity/auth-session.fixture";

import { VerifyEmailUseCase } from "./verify-email.use-case.js";

describe("VerifyEmail — 이메일 인증과 첫 세션 발급", () => {
  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    return { ...fixture, useCase: new VerifyEmailUseCase(fixture) };
  }

  async function givenCode() {
    const fixture = given({ pending: true });
    const issued = await fixture.issueVerificationCode.execute({
      userId: fixture.user.id,
      type: "EMAIL_VERIFY",
    });
    return { ...fixture, code: issued.code };
  }

  it("올바른 코드를 소비하고 계정을 활성화하며 첫 세션·프로필을 반환한다", async () => {
    // Given
    const fixture = await givenCode();
    fixture.clock.advanceBy({ minutes: 1 });
    const verifiedAt = AUTH_CREDENTIAL_NOW.add({ minutes: 1 });
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test" };
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      code: fixture.code,
      metadata,
    });
    // Then
    expect(fixture.userRepository.stored(fixture.user.id)).toMatchObject({
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
    });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ usedAt: verifiedAt }),
    ]);
    expect(fixture.sessionRepository.all).toEqual([
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
    expect(fixture.userRepository.stored(fixture.user.id)?.status).toBe("PENDING_VERIFY");
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ attempts: 1, usedAt: null }),
    ]);
    expect(fixture.sessionRepository.all).toEqual([]);
    expect(fixture.retentionEnroller.activatedUserIds).toEqual([]);
  });

  it.each(["missing", "verified", "deleted"] as const)(
    "%s 계정은 인증 처리 전에 정확한 오류로 거부한다",
    async (state) => {
      // Given
      const fixture = given({ pending: state !== "verified", empty: state === "missing" });
      if (state === "deleted") {
        const user = createIdentityUserFixture(fixture.user);
        user.requestDeletion(AUTH_CREDENTIAL_NOW);
        await fixture.userRepository.saveAccountStatus(user);
      }
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
      expect(fixture.sessionRepository.all).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );
});
