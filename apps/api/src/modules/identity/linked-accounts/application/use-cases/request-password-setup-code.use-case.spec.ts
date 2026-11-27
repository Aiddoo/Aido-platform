import { ErrorCode } from "@aido/api/errors";

import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/identity/auth-credential-scenario.fixture";
import { createUserFixture } from "#test/fixtures/identity/session.fixture";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case.js";
import { RequestPasswordSetupCodeUseCase } from "./request-password-setup-code.use-case.js";

describe("RequestPasswordSetupCode — 소셜 계정의 비밀번호 설정 요청", () => {
  it("소셜 계정에 PASSWORD_SETUP 코드를 발송하고 계정은 아직 추가하지 않는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ socialOnly: true });
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);

    // When
    const result = await useCase.execute({ userId: fixture.user.id, emailLocale: "en" });

    // Then
    expect(result.message).toBe("비밀번호 설정 코드가 이메일로 발송되었습니다.");
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "password-setup",
      locale: "en",
    });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ userId: fixture.user.id, type: "PASSWORD_SETUP", usedAt: null }),
    ]);
    expect(fixture.accountRepository.storedByProvider(fixture.user.id, "CREDENTIAL")).toBeNull();
  });

  it.each([
    ["존재하지 않는", ErrorCode.USER_0601],
    ["탈퇴한", ErrorCode.USER_0606],
    ["이미 비밀번호가 있는", ErrorCode.USER_0614],
  ] as const)("%s 사용자에게 코드를 발송하지 않는다", async (state, errorCode) => {
    // Given
    const fixture = createAuthCredentialFixture({
      empty: state === "존재하지 않는",
      socialOnly: state !== "이미 비밀번호가 있는",
    });
    if (state === "탈퇴한") {
      const user = createUserFixture(fixture.user);
      user.requestDeletion(AUTH_CREDENTIAL_NOW);
      await fixture.userRepository.save(user);
    }
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);

    // When
    const pending = useCase.execute({ userId: fixture.user.id, emailLocale: "ko" });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode });
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.verificationRepository.all).toEqual([]);
  });

  it("재발송 대기 중 재요청하면 기존 코드를 유지하고 재발송하지 않는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ socialOnly: true });
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);
    await useCase.execute({ userId: fixture.user.id, emailLocale: "ko" });
    const originalCode = fixture.emailSender.getLastCode(fixture.user.email);

    // When
    const pending = useCase.execute({ userId: fixture.user.id, emailLocale: "ko" });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0753 });
    expect(fixture.emailSender.getLastCode(fixture.user.email)).toBe(originalCode);
    expect(fixture.verificationRepository.all).toHaveLength(1);
  });

  it("사용자마다 하루 10통이고 대기로 거절한 요청은 세지 않으며 상한의 남은 초는 60초를 넘지 않는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ socialOnly: true });
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);
    const request = () =>
      useCase
        .execute({ userId: fixture.user.id, emailLocale: "ko" })
        .catch((error: unknown) => error);
    for (let issued = 0; issued < 10; issued += 1) {
      await request();
      fixture.clock.advanceBy({ seconds: 30 });
      await request();
      fixture.clock.advanceBy({ seconds: 31 });
    }

    // When
    const eleventh = await request();

    // Then
    expect(fixture.verificationRepository.all).toHaveLength(10);
    expect(eleventh).toEqual(
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 60 },
      }),
    );
  });

  it("비밀번호 재설정 요청이 그 이메일의 상한을 다 써도 로그인한 사용자는 설정 코드를 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ socialOnly: true });
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
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);

    // When
    const result = await useCase.execute({ userId: fixture.user.id, emailLocale: "ko" });

    // Then
    expect(result.message).toBe("비밀번호 설정 코드가 이메일로 발송되었습니다.");
    expect(fixture.emailSender.getSentEmail(fixture.user.email)).toMatchObject({
      type: "password-setup",
    });
  });
});
