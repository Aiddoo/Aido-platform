import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import type { AuthVerificationPrimitives } from "#api/modules/identity/auth/domain/auth-verification.aggregate";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createAuthVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  createAuthSessionFixture,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { GetCurrentUserUseCase } from "../../../users/application/use-cases/get-current-user.use-case.js";
import { SetPasswordUseCase } from "./set-password.use-case.js";

type CredentialFixture = ReturnType<typeof createAuthCredentialFixture>;

// 첫 검사와 잠금 사이에 다른 요청이 끼어든 상황을 트랜잭션 시작 시점에 재현한다
class InterleavedUnitOfWork extends UnitOfWorkPort {
  readonly #interleave: () => Promise<unknown>;

  constructor(interleave: () => Promise<unknown>) {
    super();
    this.#interleave = interleave;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.#interleave();
    return work();
  }
}

async function withdraw(fixture: CredentialFixture): Promise<void> {
  const user = createIdentityUserFixture(fixture.user);
  user.requestDeletion(AUTH_CREDENTIAL_NOW);
  await fixture.userRepository.saveAccountStatus(user);
}

describe("SetPassword — 소셜 세션을 유지하는 Credential 계정 추가", () => {
  const code = "123456";
  const newPassword = "NewPassword2!";

  async function given(
    options: Parameters<typeof createAuthCredentialFixture>[0] = {},
    verification: Partial<AuthVerificationPrimitives> = {},
  ) {
    const fixture = createAuthCredentialFixture({ socialOnly: true, ...options });
    await fixture.verificationRepository.save(
      createAuthVerificationFixture({
        userId: fixture.user.id,
        type: "PASSWORD_SETUP",
        tokenHash: fixture.verificationCodeSecurity.hash(code),
        ...verification,
      }),
    );
    return { ...fixture, useCase: new SetPasswordUseCase(fixture) };
  }

  it("설정 코드를 소비해 Credential 계정을 추가하고 기존 세션·최신 프로필을 유지한다", async () => {
    // Given
    const fixture = await given();
    const session = createAuthSessionFixture({ userId: fixture.user.id });
    await fixture.sessionRepository.save(session);
    fixture.cacheService.sessionIds.add(session.id.value);
    const currentUser = new GetCurrentUserUseCase(fixture);
    const query = { userId: fixture.user.id, sessionId: session.id.value, timezone: "Asia/Seoul" };
    const providersBefore = (await currentUser.execute(query)).providers;
    const metadata = { ip: "192.0.2.12", userAgent: "소셜 로그인 기기" };

    // When
    const result = await fixture.useCase.execute({
      userId: fixture.user.id,
      code,
      newPassword,
      metadata,
    });

    // Then
    expect(result.message).toBe("비밀번호가 설정되었습니다. 이제 이메일로 로그인할 수 있습니다.");
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toMatchObject({ password: `digest:${newPassword}` });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ usedAt: AUTH_CREDENTIAL_NOW }),
    ]);
    expect(fixture.sessionRepository.stored(session.id.value)?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has(session.id.value)).toBe(true);
    expect([providersBefore, (await currentUser.execute(query)).providers]).toEqual([
      ["GOOGLE"],
      ["GOOGLE", "CREDENTIAL"],
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.PASSWORD_SETUP,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it.each(["존재하지 않는", "탈퇴한", "이미 비밀번호가 있는"] as const)(
    "%s 사용자는 코드 소비와 계정 추가 이전에 거부한다",
    async (state) => {
      // Given
      const fixture = await given({
        empty: state === "존재하지 않는",
        socialOnly: state !== "이미 비밀번호가 있는",
      });
      if (state === "탈퇴한") {
        await withdraw(fixture);
      }
      const errorCode =
        state === "존재하지 않는"
          ? ErrorCode.USER_0601
          : state === "탈퇴한"
            ? ErrorCode.USER_0606
            : ErrorCode.USER_0614;

      // When
      const pending = fixture.useCase.execute({ userId: fixture.user.id, code, newPassword });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.verificationRepository.all).toEqual([
        expect.objectContaining({ attempts: 0, usedAt: null }),
      ]);
      expect(fixture.passwordService.hashes).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("다른 용도의 올바른 코드로는 Credential 계정을 추가하지 못한다", async () => {
    // Given
    const fixture = await given({}, { type: "PASSWORD_RESET" });

    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, code, newPassword });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toBeNull();
    expect(fixture.verificationRepository.all).toEqual([expect.objectContaining({ usedAt: null })]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("잘못된 설정 코드는 실패 횟수를 증가시키고 프로필 캐시를 유지한다", async () => {
    // Given
    const fixture = await given();
    fixture.cacheService.userIds.add(fixture.user.id);

    // When
    const pending = fixture.useCase.execute({
      userId: fixture.user.id,
      code: "000000",
      newPassword,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ attempts: 1, usedAt: null }),
    ]);
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toBeNull();
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("잠그기 전에 다른 요청이 비밀번호를 설정했으면 USER_0614로 거부하고 설정 코드를 소비하지 않는다", async () => {
    // Given
    const fixture = await given();
    const useCase = new SetPasswordUseCase({
      ...fixture,
      unitOfWork: new InterleavedUnitOfWork(() =>
        fixture.accountRepository.createCredentialAccount(
          UserId.reconstitute(fixture.user.id),
          "digest:OtherPassword3!",
        ),
      ),
    });

    // When
    const pending = useCase.execute({ userId: fixture.user.id, code, newPassword });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0614 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toMatchObject({ password: "digest:OtherPassword3!" });
    expect(fixture.verificationRepository.all).toEqual([expect.objectContaining({ usedAt: null })]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("잠그기 전에 다른 요청이 탈퇴했으면 USER_0606으로 거부하고 설정 코드를 소비하지 않는다", async () => {
    // Given
    const fixture = await given();
    const useCase = new SetPasswordUseCase({
      ...fixture,
      unitOfWork: new InterleavedUnitOfWork(() => withdraw(fixture)),
    });

    // When
    const pending = useCase.execute({ userId: fixture.user.id, code, newPassword });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0606 });
    expect(
      await fixture.accountRepository.findByUserIdAndProvider(
        UserId.reconstitute(fixture.user.id),
        "CREDENTIAL",
      ),
    ).toBeNull();
    expect(fixture.verificationRepository.all).toEqual([expect.objectContaining({ usedAt: null })]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
