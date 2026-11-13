import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import { InMemoryAuthVerificationRepository } from "#test/doubles/identity/in-memory-auth-verification.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createAuthVerificationFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";
import { StubVerificationCodeSecurity } from "#test/mocks/ports/auth-credentials.stub";

import type { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import { IssueVerificationCodeUseCase } from "./issue-verification-code.use-case.js";

describe("IssueVerificationCode — 재발송 대기와 이전 코드 만료", () => {
  function given(verifications: readonly AuthVerification[] = []) {
    const verificationRepository = new InMemoryAuthVerificationRepository(verifications);
    const verificationCodeSecurity = new StubVerificationCodeSecurity();
    const logger = new SilentLogger();
    const useCase = new IssueVerificationCodeUseCase({
      verificationRepository,
      verificationCodeSecurity,
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      logger,
    });
    return { verificationRepository, verificationCodeSecurity, logger, useCase };
  }

  function issuedSecondsAgo(seconds: number) {
    const createdAt = AUTH_FIXTURE_NOW.subtract({ milliseconds: seconds * 1000 });
    return createAuthVerificationFixture({
      createdAt,
      expiresAt: createdAt.add({ minutes: 10 }),
    });
  }

  it.each([
    { secondsAgo: 0, remainingSeconds: 60 },
    { secondsAgo: 20.5, remainingSeconds: 40 },
    { secondsAgo: 59, remainingSeconds: 1 },
    { secondsAgo: 60, remainingSeconds: 1 },
  ])(
    "같은 종류 코드를 $secondsAgo초 전에 발급했으면 VERIFY_0753과 남은 $remainingSeconds초로 거부하고 이전 코드를 그대로 둔다",
    async ({ secondsAgo, remainingSeconds }) => {
      // Given
      const previous = issuedSecondsAgo(secondsAgo);
      const fixture = given([previous]);

      // When
      const pending = fixture.useCase.execute({
        userId: AUTH_FIXTURE_USER_ID,
        type: "EMAIL_VERIFY",
      });

      // Then
      await expect(pending).rejects.toBeInstanceOf(ApplicationException);
      await expect(pending).rejects.toMatchObject({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds },
      });
      expect(fixture.verificationRepository.all).toEqual([previous.toPrimitives()]);
    },
  );

  it("같은 종류 코드가 여럿이면 가장 최근 발급부터 남은 초를 센다", async () => {
    // Given
    const older = createAuthVerificationFixture({
      id: 1,
      createdAt: AUTH_FIXTURE_NOW.subtract({ seconds: 50 }),
    });
    const latest = createAuthVerificationFixture({
      id: 2,
      createdAt: AUTH_FIXTURE_NOW.subtract({ seconds: 10 }),
    });
    const fixture = given([older, latest]);

    // When
    const pending = fixture.useCase.execute({ userId: AUTH_FIXTURE_USER_ID, type: "EMAIL_VERIFY" });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.VERIFY_0753,
      details: { remainingSeconds: 50 },
    });
  });

  it("61초 전에 발급한 같은 종류 코드는 지금 만료시키고 새 코드를 발급한다", async () => {
    // Given
    const previous = issuedSecondsAgo(61);
    const fixture = given([previous]);

    // When
    const issued = await fixture.useCase.execute({
      userId: AUTH_FIXTURE_USER_ID,
      type: "EMAIL_VERIFY",
    });

    // Then
    expect(fixture.verificationRepository.all).toEqual([
      { ...previous.toPrimitives(), expiresAt: AUTH_FIXTURE_NOW },
      expect.objectContaining({
        id: 2,
        tokenHash: fixture.verificationCodeSecurity.hash(issued.code),
      }),
    ]);
  });

  it("다른 종류·다른 사용자의 코드는 방금 발급했어도 막거나 만료시키지 않는다", async () => {
    // Given
    const otherType = createAuthVerificationFixture({ id: 1, type: "PASSWORD_RESET" });
    const otherUser = createAuthVerificationFixture({ id: 2, userId: "other-user" });
    const fixture = given([otherType, otherUser]);

    // When
    await fixture.useCase.execute({ userId: AUTH_FIXTURE_USER_ID, type: "EMAIL_VERIFY" });

    // Then
    expect(fixture.verificationRepository.all).toEqual([
      otherType.toPrimitives(),
      otherUser.toPrimitives(),
      expect.objectContaining({ id: 3, userId: AUTH_FIXTURE_USER_ID, type: "EMAIL_VERIFY" }),
    ]);
  });

  it("새 코드는 10분 뒤 만료되고 평문 대신 돌려준 코드의 digest만 저장하며 로그에 남기지 않는다", async () => {
    // Given
    const fixture = given();

    // When
    const issued = await fixture.useCase.execute({
      userId: AUTH_FIXTURE_USER_ID,
      type: "PASSWORD_SETUP",
    });

    // Then
    const expiresAt = AUTH_FIXTURE_NOW.add({ minutes: 10 });
    expect(issued.expiresAt).toEqual(expiresAt);
    expect(fixture.verificationRepository.all).toEqual([
      {
        id: 1,
        userId: AUTH_FIXTURE_USER_ID,
        type: "PASSWORD_SETUP",
        tokenHash: fixture.verificationCodeSecurity.hash(issued.code),
        expiresAt,
        attempts: 0,
        usedAt: null,
        createdAt: AUTH_FIXTURE_NOW,
      },
    ]);
    expect(JSON.stringify(fixture.logger.messages)).not.toContain(issued.code);
  });
});
