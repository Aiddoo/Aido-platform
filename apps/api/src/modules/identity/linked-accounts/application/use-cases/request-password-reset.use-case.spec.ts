import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { InMemoryPasswordResetCooldown } from "#test/doubles/identity/in-memory-password-reset-cooldown";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createUserFixture } from "#test/fixtures/identity/session.fixture";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case.js";

describe("RequestPasswordReset — 계정 존재를 노출하지 않는 재설정 요청", () => {
  it("재설정 용도의 코드를 저장·발송하고 요청 정보를 감사 기록에 남긴다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    const metadata = { ip: "192.0.2.10", userAgent: "재설정 요청 기기" };

    // When
    const result = await useCase.execute({
      email: fixture.user.email,
      metadata,
      emailLocale: "en",
    });

    // Then
    expect(result).toEqual({ message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다." });
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "password-reset",
      code: "123456",
      locale: "en",
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
        const user = createUserFixture(fixture.user);
        user.requestDeletion(AUTH_CREDENTIAL_NOW);
        await fixture.userRepository.save(user);
      }
      const useCase = new RequestPasswordResetUseCase(fixture);

      // When
      const result = await useCase.execute({ email: fixture.user.email, emailLocale: "ko" });

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
    await useCase.execute({ email: fixture.user.email, emailLocale: "ko" });

    // Then
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({
        ipAddress: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      }),
    ]);
  });

  it("가입한 이메일과 없는 이메일이 60초 안에 다시 요청하면 같은 VERIFY_0753과 남은 초를 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const clock = new FixedClock(AUTH_CREDENTIAL_NOW);
    const useCase = new RequestPasswordResetUseCase({ ...fixture, clock });
    const emails = [fixture.user.email, "nobody@example.com"];
    for (const email of emails) {
      await useCase.execute({ email, emailLocale: "ko" });
    }
    clock.advanceBy({ seconds: 20 });

    // When
    const retries = await Promise.all(
      emails.map((email) =>
        useCase.execute({ email, emailLocale: "ko" }).catch((error: unknown) => error),
      ),
    );

    // Then
    expect(retries).toEqual([
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 40 },
      }),
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 40 },
      }),
    ]);
  });

  it("없는 이메일도 대문자로 다시 요청하면 같은 대기로 막고 60초 뒤에는 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const clock = new FixedClock(AUTH_CREDENTIAL_NOW);
    const useCase = new RequestPasswordResetUseCase({ ...fixture, clock });
    await useCase.execute({ email: "nobody@example.com", emailLocale: "ko" });

    // When
    const retry = await useCase
      .execute({ email: "NOBODY@example.com", emailLocale: "ko" })
      .catch((error: unknown) => error);
    clock.advanceBy({ seconds: 60 });
    const afterCooldown = await useCase.execute({ email: "nobody@example.com", emailLocale: "ko" });

    // Then
    expect(retry).toEqual(expect.objectContaining({ errorCode: ErrorCode.VERIFY_0753 }));
    expect(afterCooldown).toEqual({
      message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
    });
  });

  it("가입한 이메일이 정확히 60초 뒤 다시 요청하면 새 코드를 보내고 응답은 없는 이메일과 같다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    await useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    await useCase.execute({ email: "nobody@example.com", emailLocale: "ko" });
    fixture.clock.advanceBy({ seconds: 60 });
    fixture.emailSender.clear();

    // When
    const known = await useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    const unknown = await useCase.execute({ email: "nobody@example.com", emailLocale: "ko" });

    // Then
    expect(known).toEqual(unknown);
    expect(fixture.verificationRepository.all).toHaveLength(2);
    expect(fixture.emailSender.hasSentTo(fixture.user.email)).toBe(true);
  });

  it("이메일 대기가 캐시에서 사라져도 가입한 이메일은 없는 이메일과 같은 성공 응답이다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const clock = new FixedClock(AUTH_CREDENTIAL_NOW);
    await new RequestPasswordResetUseCase({ ...fixture, clock }).execute({
      email: fixture.user.email,
      emailLocale: "ko",
    });
    clock.advanceBy({ seconds: 10 });
    const afterEviction = new RequestPasswordResetUseCase({
      ...fixture,
      clock,
      resetCooldown: new InMemoryPasswordResetCooldown(),
    });

    // When
    const known = await afterEviction.execute({ email: fixture.user.email, emailLocale: "ko" });
    const unknown = await afterEviction.execute({ email: "nobody@example.com", emailLocale: "ko" });

    // Then
    expect(known).toEqual(unknown);
    expect(fixture.verificationRepository.all).toHaveLength(1);
  });
});
