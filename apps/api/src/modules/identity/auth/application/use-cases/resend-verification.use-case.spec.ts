import { ErrorCode } from "@aido/api/errors";

import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";

import { ResendVerificationUseCase } from "./resend-verification.use-case.js";

describe("ResendVerification — 이메일 인증 코드 재발송", () => {
  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    return { ...fixture, useCase: new ResendVerificationUseCase(fixture) };
  }

  it("미인증 사용자에게 해시된 새 코드를 저장하고 메일을 발송한다", async () => {
    // Given
    const fixture = given({ pending: true });
    // When
    const result = await fixture.useCase.execute({ email: fixture.user.email });
    // Then
    expect(result.message).toBe("인증 코드가 발송되었습니다. 이메일을 확인해주세요.");
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "verification",
      code: "123456",
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
    const result = await fixture.useCase.execute({ email: fixture.user.email });
    // Then
    expect(result.message).toBe("인증 코드가 발송되었습니다. 이메일을 확인해주세요.");
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.verificationRepository.all).toEqual([]);
  });

  it("이미 인증한 계정의 재발송은 USER_0604로 거부한다", async () => {
    // Given
    const fixture = given();
    // When
    const pending = fixture.useCase.execute({ email: fixture.user.email });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0604 });
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.verificationRepository.all).toEqual([]);
  });

  it("재발송 대기 중에는 이전 코드를 유지하고 중복 발송하지 않는다", async () => {
    // Given
    const fixture = given({ pending: true });
    await fixture.useCase.execute({ email: fixture.user.email });
    // When
    const pending = fixture.useCase.execute({ email: fixture.user.email });
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
    const result = await useCase.execute({ email: fixture.user.email });
    // Then
    expect(result.message).toContain("발송되었습니다");
    expect(fixture.verificationRepository.all).toHaveLength(1);
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("private SMTP payload");
  });
});
