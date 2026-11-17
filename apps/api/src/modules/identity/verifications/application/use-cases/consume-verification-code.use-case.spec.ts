import { ErrorCode } from "@aido/api/errors";

import { InMemoryVerificationRepository } from "#test/doubles/identity/in-memory-verification.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_NOW, AUTH_FIXTURE_USER_ID } from "#test/fixtures/identity/session.fixture";
import { StubVerificationCodeSecurity } from "#test/mocks/ports/auth-credentials.stub";

import type { Verification } from "../../domain/verification.aggregate.js";
import { ConsumeVerificationCodeUseCase } from "./consume-verification-code.use-case.js";

describe("ConsumeVerificationCode — 인증 코드 한 번 사용과 실패 횟수", () => {
  const code = "123456";
  const command = { userId: AUTH_FIXTURE_USER_ID, code, type: "EMAIL_VERIFY" } as const;

  function given(verifications: readonly Verification[] = []) {
    const verificationRepository = new InMemoryVerificationRepository(verifications);
    const clock = new FixedClock(AUTH_FIXTURE_NOW);
    const useCase = new ConsumeVerificationCodeUseCase({
      verificationRepository,
      verificationCodeSecurity: new StubVerificationCodeSecurity(),
      clock,
      logger: new SilentLogger(),
    });
    return { verificationRepository, clock, useCase };
  }

  it.each([
    { state: "없는", verifications: [] },
    {
      state: "이미 쓴",
      verifications: [createVerificationFixture({ usedAt: AUTH_FIXTURE_NOW })],
    },
    {
      state: "만료 시각에 이른",
      verifications: [createVerificationFixture({ expiresAt: AUTH_FIXTURE_NOW })],
    },
  ])(
    "$state 코드는 맞는 값이어도 VERIFY_0751로 거부하고 시도로 세지 않는다",
    async ({ verifications }) => {
      // Given
      const fixture = given(verifications);

      // When
      const pending = fixture.useCase.execute(command);

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
      expect(fixture.verificationRepository.all).toEqual(
        verifications.map((verification) => verification.toPrimitives()),
      );
    },
  );

  it.each([code, "000000"])(
    "시도 5회를 채운 코드에 %s를 넣으면 VERIFY_0754로 거부하고 시도를 더 세지 않는다",
    async (attempted) => {
      // Given
      const fixture = given([createVerificationFixture({ attempts: 5 })]);

      // When
      const pending = fixture.useCase.execute({ ...command, code: attempted });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0754 });
      expect(fixture.verificationRepository.all).toEqual([
        expect.objectContaining({ attempts: 5, usedAt: null }),
      ]);
    },
  );

  it("틀린 코드는 시도 1회를 더하고 VERIFY_0751로 거부한다", async () => {
    // Given
    const fixture = given([createVerificationFixture()]);

    // When
    const pending = fixture.useCase.execute({ ...command, code: "000000" });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ attempts: 1, usedAt: null }),
    ]);
  });

  it("다섯 번째로 틀리면 그 뒤에는 맞는 코드도 VERIFY_0754로 거부한다", async () => {
    // Given
    const fixture = given([createVerificationFixture({ attempts: 4 })]);
    await expect(fixture.useCase.execute({ ...command, code: "000000" })).rejects.toMatchObject({
      errorCode: ErrorCode.VERIFY_0751,
    });

    // When
    const pending = fixture.useCase.execute(command);

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0754 });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ attempts: 5, usedAt: null }),
    ]);
  });

  it("맞는 코드는 지금 시각으로 사용 처리하고 같은 코드를 다시 쓰면 VERIFY_0751이다", async () => {
    // Given
    const fixture = given([createVerificationFixture()]);
    fixture.clock.advanceBy({ minutes: 3 });
    const consumedAt = AUTH_FIXTURE_NOW.add({ minutes: 3 });

    // When
    await fixture.useCase.execute(command);
    const second = fixture.useCase.execute(command);

    // Then
    await expect(second).rejects.toMatchObject({ errorCode: ErrorCode.VERIFY_0751 });
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({ attempts: 0, usedAt: consumedAt }),
    ]);
  });
});
