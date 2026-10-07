import { vi } from "vitest";

import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { RequestPasswordReset } from "./request-password-reset.use-case.js";

describe("RequestPasswordReset — 계정 존재를 노출하지 않는 재설정 요청", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("재설정 용도의 코드를 저장·발송하고 요청 정보를 감사 기록에 남긴다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordReset(fixture);
    const metadata = { ip: "192.0.2.10", userAgent: "재설정 요청 기기" };

    // When
    const result = await useCase.execute({ email: fixture.user.email, metadata });

    // Then
    expect(result).toEqual({ message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다." });
    const sentEmail = fixture.emailSender.getSentEmail(fixture.user.email);
    expect(sentEmail).toMatchObject({ type: "password-reset", sentAt: AUTH_CREDENTIAL_TIME });
    expect([...fixture.verificationRepository.verifications.values()]).toEqual([
      expect.objectContaining({ userId: fixture.user.id, type: "PASSWORD_RESET", usedAt: null }),
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
      if (state === "탈퇴한")
        await fixture.userRepository.softDelete(fixture.user.id, AUTH_CREDENTIAL_TIME);
      const useCase = new RequestPasswordReset(fixture);

      // When
      const result = await useCase.execute({ email: fixture.user.email });

      // Then
      expect(result).toEqual({
        message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
      });
      expect(fixture.emailSender.getSentCount()).toBe(0);
      expect(fixture.verificationRepository.verifications.size).toBe(0);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("요청 정보가 없으면 기존 기본값으로 감사 기록을 저장한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordReset(fixture);

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
