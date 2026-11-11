import { ErrorCode } from "@aido/api/errors";

import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import {
  AUTH_CREDENTIAL_NOW,
  AUTH_CREDENTIAL_PASSWORD,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { AuthLogEvent } from "../auth.log-events.js";
import { RegisterUseCase } from "./register.use-case.js";

// 중복 조회와 저장 사이에 다른 요청이 끼어든 상황을 트랜잭션 시작 시점에 재현한다
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

describe("Register — 이메일 계정 등록", () => {
  const input = {
    email: "new@example.com",
    password: AUTH_CREDENTIAL_PASSWORD,
    name: "신규 사용자",
    termsAgreed: true,
    privacyAgreed: true,
    marketingAgreed: false,
    marketingPushAgreed: false,
  } satisfies Parameters<RegisterUseCase["execute"]>[0];

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    return { ...fixture, useCase: new RegisterUseCase(fixture) };
  }

  it("가입 요청의 언어를 기본 카테고리 이름에 넘긴다", async () => {
    // Given
    const fixture = given();
    // When
    await fixture.useCase.execute({ ...input, metadata: { locale: "en" } });
    // Then
    expect(fixture.seeder.categoryLocales).toEqual(["en"]);
  });

  it("미인증 계정·프로필·동의를 저장하고 인증 메일과 등록 알림을 발송한다", async () => {
    // Given
    const fixture = given({ empty: true });
    const metadata = {
      ip: "192.0.2.1",
      userAgent: "Aido-Test",
      device: { devicePlatform: "ANDROID" as const, deviceModel: "Galaxy S24" },
    };
    // When
    const result = await fixture.useCase.execute({ ...input, metadata });
    // Then
    expect(result).toMatchObject({ email: input.email, emailSent: true });
    expect(fixture.userRepository.stored(result.userId)).toMatchObject({
      status: "PENDING_VERIFY",
      emailVerifiedAt: null,
    });
    expect(fixture.accountRepository.all).toEqual([
      expect.objectContaining({
        userId: result.userId,
        provider: "CREDENTIAL",
        password: `digest:${input.password}`,
      }),
    ]);
    expect(fixture.userRepository.profileOf(result.userId)).toEqual({
      name: input.name,
      profileImage: null,
    });
    expect(fixture.seeder.settings).toEqual([
      {
        userId: result.userId,
        consent: {
          termsAgreedAt: AUTH_CREDENTIAL_NOW,
          privacyAgreedAt: AUTH_CREDENTIAL_NOW,
          agreedTermsVersion: "1.0.0",
          marketingAgreedAt: undefined,
          marketingPushAgreedAt: undefined,
        },
      },
    ]);
    expect(fixture.seeder.categoryUserIds).toEqual([result.userId]);
    expect(fixture.retentionEnroller.enrollments).toEqual([
      { userId: result.userId, activated: false },
    ]);
    expect(fixture.emailSender.getLastCode(input.email)).toBe("123456");
    expect(fixture.verificationRepository.all).toEqual([
      expect.objectContaining({
        userId: result.userId,
        tokenHash: "digest:123456",
        type: "EMAIL_VERIFY",
      }),
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: result.userId,
        event: "REGISTRATION",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
    expect(fixture.adminEventNotifier.notifications).toEqual([
      {
        userId: result.userId,
        email: input.email,
        provider: "credential",
        registeredAt: "2026-11-10T00:00:00.000Z",
        name: input.name,
        devicePlatform: "ANDROID",
        deviceModel: "Galaxy S24",
      },
    ]);
    const logs = JSON.stringify(fixture.logger.messages);
    expect(logs).not.toContain(input.email);
    expect(logs).not.toContain(input.password);
  });

  it("이미 등록한 이메일은 해시·저장·발송 없이 거부한다", async () => {
    // Given
    const fixture = given();
    // When
    const pending = fixture.useCase.execute({ ...input, email: fixture.user.email });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.EMAIL_0501,
      details: { email: fixture.user.email },
    });
    expect(fixture.passwordService.hashes).toEqual([]);
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.userRepository.all).toHaveLength(1);
  });

  it("조회 뒤 다른 요청이 같은 이메일로 먼저 가입하면 EMAIL_0501로 거부하고 발송하지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });
    const useCase = new RegisterUseCase({
      ...fixture,
      unitOfWork: new InterleavedUnitOfWork(() =>
        fixture.userRepository.create({ email: input.email, status: "PENDING_VERIFY" }),
      ),
    });
    // When
    const pending = useCase.execute(input);
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.EMAIL_0501 });
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.adminEventNotifier.notifications).toEqual([]);
  });

  it("이메일 중복이 아닌 저장 실패는 그대로 던지고 발송하지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });
    const failure = new Error("other storage failure");
    const useCase = new RegisterUseCase({
      ...fixture,
      unitOfWork: new InterleavedUnitOfWork(async () => {
        throw failure;
      }),
    });
    // When
    const pending = useCase.execute(input);
    // Then
    await expect(pending).rejects.toBe(failure);
    expect(fixture.emailSender.getSentCount()).toBe(0);
    expect(fixture.adminEventNotifier.notifications).toEqual([]);
  });

  it("발송 큐에 담지 못해도 가입을 유지하고 emailSent:false와 재발송 안내를 돌려준다", async () => {
    // Given
    const fixture = given({ empty: true });
    fixture.emailSender.simulateFailures(1);
    // When
    const result = await fixture.useCase.execute(input);
    // Then
    expect(result.emailSent).toBe(false);
    expect(result.message).toContain("재발송");
    expect(fixture.userRepository.stored(result.userId)).toBeDefined();
  });

  it("메일 발송 예외가 나도 저장한 가입을 유지하고 재발송 안내를 반환한다", async () => {
    // Given
    const fixture = given({ empty: true });
    const useCase = new RegisterUseCase({
      ...fixture,
      sendVerificationCode: {
        execute: async () => {
          throw new Error("private SMTP detail");
        },
      },
    });
    // When
    const result = await useCase.execute(input);
    // Then
    expect(result.emailSent).toBe(false);
    expect(result.message).toContain("재발송");
    expect(fixture.userRepository.stored(result.userId)).toBeDefined();
    expect(fixture.adminEventNotifier.notifications).toHaveLength(1);
    expect(fixture.logger.messages).toContainEqual(
      expect.objectContaining({ event: AuthLogEvent.VERIFICATION_EMAIL_FAILED }),
    );
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("private SMTP detail");
  });
});
