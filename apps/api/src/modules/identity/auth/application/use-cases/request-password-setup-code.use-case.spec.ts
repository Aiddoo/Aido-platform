import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createIdentityUserFixture } from "#test/fixtures/identity/auth-session.fixture";

import { RequestPasswordSetupCodeUseCase } from "./request-password-setup-code.use-case.js";

describe("RequestPasswordSetupCode — 소셜 계정의 비밀번호 설정 요청", () => {
  it("소셜 계정에 PASSWORD_SETUP 코드를 발송하고 계정은 아직 추가하지 않는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ socialOnly: true });
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);

    // When
    const result = await useCase.execute({ userId: fixture.user.id });

    // Then
    expect(result.message).toBe("비밀번호 설정 코드가 이메일로 발송되었습니다.");
    expect(fixture.emailSender.getSentEmail(fixture.user.email)?.type).toBe("password-setup");
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ userId: fixture.user.id, type: "PASSWORD_SETUP", usedAt: null }),
    ]);
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toBeNull();
  });

  it.each(["존재하지 않는", "탈퇴한", "이미 비밀번호가 있는"] as const)(
    "%s 사용자에게 코드를 발송하지 않는다",
    async (state) => {
      // Given
      const fixture = createAuthCredentialFixture({
        empty: state === "존재하지 않는",
        socialOnly: state !== "이미 비밀번호가 있는",
      });
      if (state === "탈퇴한") {
        const user = createIdentityUserFixture(fixture.user);
        user.requestDeletion(AUTH_CREDENTIAL_NOW);
        await fixture.userRepository.saveAccountStatus(user);
      }
      const useCase = new RequestPasswordSetupCodeUseCase(fixture);
      const errorCode =
        state === "존재하지 않는"
          ? ErrorCode.USER_0601
          : state === "탈퇴한"
            ? ErrorCode.USER_0606
            : ErrorCode.USER_0614;

      // When
      const pending = useCase.execute({ userId: fixture.user.id });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.emailSender.getSentCount()).toBe(0);
      expect(fixture.verificationRepository.all).toEqual([]);
    },
  );

  it("재발송 대기 중 재요청하면 기존 코드를 유지하고 재발송하지 않는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ socialOnly: true });
    const useCase = new RequestPasswordSetupCodeUseCase(fixture);
    await useCase.execute({ userId: fixture.user.id });
    const originalCode = fixture.emailSender.getLastCode(fixture.user.email);

    // When
    const pending = useCase.execute({ userId: fixture.user.id });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0753 });
    expect(fixture.emailSender.getLastCode(fixture.user.email)).toBe(originalCode);
    expect(fixture.verificationRepository.all).toHaveLength(1);
  });
});
