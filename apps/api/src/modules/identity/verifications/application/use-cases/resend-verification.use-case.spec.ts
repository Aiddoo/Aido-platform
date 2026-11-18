import { ErrorCode } from "@aido/api/errors";

import { RequestPasswordResetUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/request-password-reset.use-case";
import { createAuthCredentialFixture } from "#test/fixtures/identity/auth-credential-scenario.fixture";

import { ResendVerificationUseCase } from "./resend-verification.use-case.js";

const SENT_MESSAGE = { message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요." };

describe("ResendVerification — 이메일 인증 코드 재발송", () => {
  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    return { ...fixture, useCase: new ResendVerificationUseCase(fixture) };
  }

  it("미인증 사용자에게 해시된 새 코드를 저장하고 메일을 발송한다", async () => {
    // Given
    const fixture = given({ pending: true });
    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      emailLocale: "en",
    });
    // Then
    expect(result.message).toBe("인증 코드가 발송되었습니다. 이메일을 확인해주세요.");
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "verification",
      code: "123456",
      locale: "en",
    });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({
        userId: fixture.user.id,
        tokenHash: "digest:123456",
        type: "EMAIL_VERIFY",
      }),
    ]);
  });

  it("없는 이메일도 같은 응답을 반환하고 저장·메일 발송은 하지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });
    // When
    const result = await fixture.useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    // Then
    expect(result.message).toBe("인증 코드가 발송되었습니다. 이메일을 확인해주세요.");
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.verificationRepository.all).toEqual([]);
  });

  it("이미 인증한 계정의 재발송은 USER_0604로 거부한다", async () => {
    // Given
    const fixture = given();
    // When
    const pending = fixture.useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0604 });
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.verificationRepository.all).toEqual([]);
  });

  it("재발송 대기 중에는 이전 코드를 유지하고 중복 발송하지 않는다", async () => {
    // Given
    const fixture = given({ pending: true });
    await fixture.useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    // When
    const pending = fixture.useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0753 });
    expect(fixture.verificationRepository.all).toHaveLength(1);
    expect(fixture.emailSender.getSentCount()).toBe(1);
  });

  it("발송 예외가 나도 재발송 응답과 저장한 코드를 유지한다", async () => {
    // Given
    const fixture = given({ pending: true });
    const useCase = new ResendVerificationUseCase({
      ...fixture,
      sendVerificationCode: {
        execute: async () => {
          throw new Error("private SMTP payload");
        },
      },
    });
    // When
    const result = await useCase.execute({ email: fixture.user.email, emailLocale: "ko" });
    // Then
    expect(result.message).toContain("발송되었습니다");
    expect(fixture.verificationRepository.all).toHaveLength(1);
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("private SMTP payload");
  });

  it("60초 대기 중 반복 탭은 상한을 쓰지 않아 그 IP의 5번째 코드도 받는다", async () => {
    // Given
    const fixture = given({ pending: true });
    const resend = () =>
      fixture.useCase
        .execute({ email: fixture.user.email, emailLocale: "ko", sourceIp: "192.0.2.10" })
        .catch((error: unknown) => error);
    for (let issued = 0; issued < 4; issued += 1) {
      await resend();
      for (let tap = 0; tap < 5; tap += 1) {
        fixture.clock.advanceBy({ seconds: 10 });
        await resend();
      }
      fixture.clock.advanceBy({ seconds: 11 });
    }

    // When
    const fifth = await resend();
    fixture.clock.advanceBy({ seconds: 61 });
    const sixth = await resend();

    // Then
    expect(fifth).toEqual(SENT_MESSAGE);
    expect(fixture.verificationRepository.all).toHaveLength(5);
    expect(sixth).toEqual(expect.objectContaining({ errorCode: ErrorCode.VERIFY_0753 }));
  });

  it("이미 인증한 계정의 거절은 상한을 쓰지 않아 몇 번을 보내도 USER_0604다", async () => {
    // Given
    const fixture = given();
    const resend = () =>
      fixture.useCase
        .execute({ email: fixture.user.email, emailLocale: "ko", sourceIp: "192.0.2.10" })
        .catch((error: unknown) => error);
    for (let rejected = 0; rejected < 5; rejected += 1) {
      await resend();
      fixture.clock.advanceBy({ seconds: 61 });
    }

    // When
    const sixth = await resend();

    // Then
    expect(sixth).toEqual(expect.objectContaining({ errorCode: ErrorCode.USER_0604 }));
  });

  it("가입 대기 이메일과 없는 이메일은 IP 상한과 이메일 상한에서 같은 VERIFY_0753·남은 초를 받는다", async () => {
    // Given
    const fixture = given({ pending: true });
    const emails = [fixture.user.email, "nobody@example.com"];
    const resend = (email: string, sourceIp: string) =>
      fixture.useCase
        .execute({ email, emailLocale: "ko", sourceIp })
        .catch((error: unknown) => error);
    for (const sourceIp of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"]) {
      for (let request = 0; request < 5; request += 1) {
        for (const email of emails) {
          await resend(email, sourceIp);
        }
        fixture.clock.advanceBy({ seconds: 61 });
      }
    }

    // When
    const atSourceCap = await Promise.all(emails.map((email) => resend(email, "198.51.100.1")));
    const atEmailCap = await Promise.all(emails.map((email) => resend(email, "192.0.2.10")));

    // Then
    const capped = expect.objectContaining({
      errorCode: ErrorCode.VERIFY_0753,
      details: { remainingSeconds: 60 },
    });
    expect(atSourceCap).toEqual([capped, capped]);
    expect(atEmailCap).toEqual([capped, capped]);
    expect(fixture.verificationRepository.all).toHaveLength(20);
  });

  it("다른 IP가 그 이메일의 IP 몫을 다 써도 본인 IP에서는 코드를 받는다", async () => {
    // Given
    const fixture = given({ pending: true });
    for (let request = 0; request < 5; request += 1) {
      await fixture.useCase.execute({
        email: fixture.user.email,
        emailLocale: "ko",
        sourceIp: "203.0.113.66",
      });
      fixture.clock.advanceBy({ seconds: 61 });
    }

    // When
    const fromOwner = await fixture.useCase.execute({
      email: fixture.user.email,
      emailLocale: "ko",
      sourceIp: "192.0.2.10",
    });

    // Then
    expect(fromOwner).toEqual(SENT_MESSAGE);
    expect(fixture.verificationRepository.all).toHaveLength(6);
  });

  it("비밀번호 재설정 요청이 그 이메일의 상한을 다 써도 가입 인증 코드는 받는다", async () => {
    // Given
    const fixture = given({ pending: true });
    const requestReset = new RequestPasswordResetUseCase(fixture);
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"]) {
      for (let request = 0; request < 5; request += 1) {
        await requestReset.execute({
          email: fixture.user.email,
          metadata: { ip },
          emailLocale: "ko",
        });
        fixture.clock.advanceBy({ seconds: 61 });
      }
    }

    // When
    const resent = await fixture.useCase.execute({
      email: fixture.user.email,
      emailLocale: "ko",
      sourceIp: "198.51.100.1",
    });

    // Then
    expect(resent).toEqual(SENT_MESSAGE);
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "verification",
    });
  });
});
