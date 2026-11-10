import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createIdentityUserFixture } from "#test/fixtures/identity/auth-session.fixture";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case.js";

describe("RequestPasswordReset — 계정 존재를 노출하지 않는 재설정 요청", () => {
  it("재설정 용도의 코드를 저장·발송하고 요청 정보를 감사 기록에 남긴다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    const metadata = { ip: "192.0.2.10", userAgent: "재설정 요청 기기" };

    // When
    const result = await useCase.execute({ email: fixture.user.email, metadata });

    // Then
    expect(result).toEqual({ message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다." });
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "password-reset",
      code: "123456",
    });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({
        userId: fixture.user.id,
        type: "PASSWORD_RESET",
        tokenHash: "digest:123456",
        usedAt: null,
      }),
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.PASSWORD_RESET_REQUESTED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { email: fixture.user.email },
      },
    ]);
  });

  it.each(["존재하지 않는", "탈퇴한"] as const)(
    "%s 사용자에게는 발송 없이 동일한 응답을 반환한다",
    async (state) => {
      // Given
      const fixture = createAuthCredentialFixture({ empty: state === "존재하지 않는" });
      if (state === "탈퇴한") {
        const user = createIdentityUserFixture(fixture.user);
        user.requestDeletion(AUTH_CREDENTIAL_NOW);
        await fixture.userRepository.saveAccountStatus(user);
      }
      const useCase = new RequestPasswordResetUseCase(fixture);

      // When
      const result = await useCase.execute({ email: fixture.user.email });

      // Then
      expect(result).toEqual({
        message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
      });
      expect(fixture.emailSender.getSentCount()).toBe(0);
      expect(fixture.verificationRepository.all).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("요청 정보가 없으면 기존 기본값으로 감사 기록을 저장한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);

    // When
    await useCase.execute({ email: fixture.user.email });

    // Then
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      }),
    ]);
  });
});
