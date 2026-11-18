import { ErrorCode } from "@aido/api/errors";

import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import { InMemoryPasswordResetCooldown } from "#test/doubles/identity/in-memory-password-reset-cooldown";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/identity/auth-credential-scenario.fixture";
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

  it("한 IP는 이메일마다 하루 5통이고 가입한 이메일과 없는 이메일은 같은 VERIFY_0753·남은 초를 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    const emails = [fixture.user.email, "nobody@example.com"];
    const metadata = { ip: "192.0.2.10" };
    for (let request = 0; request < 5; request += 1) {
      for (const email of emails) {
        await useCase.execute({ email, metadata, emailLocale: "ko" });
      }
      fixture.clock.advanceBy({ seconds: 61 });
    }

    // When
    const capped = await Promise.all(
      emails.map((email) =>
        useCase.execute({ email, metadata, emailLocale: "ko" }).catch((error: unknown) => error),
      ),
    );

    // Then
    // 출시 앱은 남은 초를 초 단위 타이머로만 보여 줘 상한에서도 60초를 넘기지 않는다
    const remainingSeconds = 60;
    expect(capped).toEqual([
      expect.objectContaining({ errorCode: ErrorCode.VERIFY_0753, details: { remainingSeconds } }),
      expect.objectContaining({ errorCode: ErrorCode.VERIFY_0753, details: { remainingSeconds } }),
    ]);
    expect(fixture.verificationRepository.all).toHaveLength(5);
  });

  it("한 IP가 그 이메일 몫을 다 써도 다른 IP의 본인은 재설정 코드를 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    for (let request = 0; request < 5; request += 1) {
      await useCase.execute({
        email: fixture.user.email,
        metadata: { ip: "203.0.113.66" },
        emailLocale: "ko",
      });
      fixture.clock.advanceBy({ seconds: 61 });
    }
    fixture.emailSender.clear();

    // When
    const fromOwner = await useCase.execute({
      email: fixture.user.email,
      metadata: { ip: "192.0.2.10" },
      emailLocale: "ko",
    });

    // Then
    expect(fromOwner).toEqual({
      message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
    });
    expect(fixture.emailSender.hasSentTo(fixture.user.email)).toBe(true);
  });

  it("이메일마다 하루 20통을 채우면 새 IP도 막고 가입 여부와 상관없이 같은 응답이다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    const emails = [fixture.user.email, "nobody@example.com"];
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"]) {
      for (let request = 0; request < 5; request += 1) {
        for (const email of emails) {
          await useCase.execute({ email, metadata: { ip }, emailLocale: "ko" });
        }
        fixture.clock.advanceBy({ seconds: 61 });
      }
    }

    // When
    const capped = await Promise.all(
      emails.map((email) =>
        useCase
          .execute({ email, metadata: { ip: "192.0.2.10" }, emailLocale: "ko" })
          .catch((error: unknown) => error),
      ),
    );

    // Then
    expect(capped).toEqual([
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 60 },
      }),
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 60 },
      }),
    ]);
    expect(fixture.verificationRepository.all).toHaveLength(20);
  });

  it("이메일 상한을 채워도 마지막 발송 한 시간 뒤에는 가입 여부와 상관없이 같은 응답으로 한 통을 더 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    const emails = [fixture.user.email, "nobody@example.com"];
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"]) {
      for (let request = 0; request < 5; request += 1) {
        for (const email of emails) {
          await useCase.execute({ email, metadata: { ip }, emailLocale: "ko" });
        }
        fixture.clock.advanceBy({ seconds: 61 });
      }
    }
    fixture.clock.advanceBy({ minutes: 59 });
    const request = (email: string) =>
      useCase
        .execute({ email, metadata: { ip: "192.0.2.10" }, emailLocale: "ko" })
        .catch((error: unknown) => error);

    // When
    const afterOneHour = await Promise.all(emails.map(request));
    fixture.clock.advanceBy({ seconds: 61 });
    const rightAfter = await Promise.all(emails.map(request));

    // Then
    expect(afterOneHour).toEqual([
      { message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다." },
      { message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다." },
    ]);
    expect(rightAfter).toEqual([
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 60 },
      }),
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 60 },
      }),
    ]);
    expect(fixture.verificationRepository.all).toHaveLength(21);
  });

  it("IPv6 /64 대역 안에서 주소를 바꿔도 한 곳으로 세어 이메일마다 하루 5통이다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    for (let request = 0; request < 5; request += 1) {
      await useCase.execute({
        email: fixture.user.email,
        metadata: { ip: `2001:db8:1:2::${request + 1}` },
        emailLocale: "ko",
      });
      fixture.clock.advanceBy({ seconds: 61 });
    }

    // When
    const sixth = await useCase
      .execute({
        email: fixture.user.email,
        metadata: { ip: "2001:db8:1:2:ffff::6" },
        emailLocale: "ko",
      })
      .catch((error: unknown) => error);

    // Then
    expect(sixth).toEqual(
      expect.objectContaining({
        errorCode: ErrorCode.VERIFY_0753,
        details: { remainingSeconds: 60 },
      }),
    );
    expect(fixture.verificationRepository.all).toHaveLength(5);
  });

  it("60초 대기 중 다시 누른 요청은 상한을 쓰지 않아 그 IP의 5번째 코드도 받는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new RequestPasswordResetUseCase(fixture);
    const request = () =>
      useCase
        .execute({ email: fixture.user.email, emailLocale: "ko" })
        .catch((error: unknown) => error);
    for (let issued = 0; issued < 4; issued += 1) {
      await request();
      for (let tap = 0; tap < 5; tap += 1) {
        fixture.clock.advanceBy({ seconds: 10 });
        await request();
      }
      fixture.clock.advanceBy({ seconds: 11 });
    }

    // When
    const fifth = await request();
    fixture.clock.advanceBy({ seconds: 61 });
    const sixth = await request();

    // Then
    expect(fifth).toEqual({ message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다." });
    expect(fixture.verificationRepository.all).toHaveLength(5);
    expect(sixth).toEqual(expect.objectContaining({ errorCode: ErrorCode.VERIFY_0753 }));
  });
});
