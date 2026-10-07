import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

describe("ProvisionUser — 신규 계정과 기본 설정 생성", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("이메일 계정은 미인증 상태로 계정·프로필·동의와 기본 설정을 생성한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ empty: true });
    const consent = { termsAgreedAt: AUTH_CREDENTIAL_TIME };

    // When
    const result = await fixture.provisionUserUseCase.execute({
      email: "new@example.com",
      status: "PENDING_VERIFY",
      account: { kind: "credential", hashedPassword: "digest:password" },
      profile: { name: "신규 사용자" },
      consent,
    });

    // Then
    expect(result.email).toBe("new@example.com");
    expect(fixture.userRepository.users.get(result.id)).toMatchObject({
      email: result.email,
      status: "PENDING_VERIFY",
      emailVerifiedAt: null,
    });
    expect(fixture.accountRepository.accounts).toEqual([
      expect.objectContaining({
        userId: result.id,
        provider: "CREDENTIAL",
        password: "digest:password",
      }),
    ]);
    expect(fixture.userRepository.profiles.get(result.id)).toEqual({
      name: "신규 사용자",
      profileImage: null,
    });
    expect(fixture.seeder.settings).toEqual([{ userId: result.id, consent }]);
    expect(fixture.seeder.categoryUserIds).toEqual([result.id]);
    expect(fixture.retentionEnroller.enrollments).toEqual([
      { userId: result.id, activated: false },
    ]);
  });

  it("OAuth 계정은 검증 날짜·프로필·동의를 보존하고 활성 사용자로 실험에 등록한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ empty: true });
    const accountWrite = vi.spyOn(fixture.accountRepository, "createOAuthAccount");
    const consent = {
      termsAgreedAt: AUTH_CREDENTIAL_TIME,
      privacyAgreedAt: AUTH_CREDENTIAL_TIME,
      marketingAgreedAt: AUTH_CREDENTIAL_TIME,
    };

    // When
    const result = await fixture.provisionUserUseCase.execute({
      email: "social@example.com",
      status: "ACTIVE",
      emailVerifiedAt: AUTH_CREDENTIAL_TIME,
      account: {
        kind: "oauth",
        provider: "GOOGLE",
        providerAccountId: "google-account-123",
        refreshToken: "social-refresh-token",
      },
      profile: { name: "소셜 사용자", profileImage: "https://example.com/avatar.png" },
      consent,
    });

    // Then
    expect(fixture.userRepository.users.get(result.id)).toMatchObject({
      email: "social@example.com",
      status: "ACTIVE",
      emailVerifiedAt: AUTH_CREDENTIAL_TIME,
    });
    expect(fixture.accountRepository.accounts).toEqual([
      expect.objectContaining({
        userId: result.id,
        provider: "GOOGLE",
        providerAccountId: "google-account-123",
        password: null,
      }),
    ]);
    expect(accountWrite).toHaveBeenCalledExactlyOnceWith({
      userId: result.id,
      provider: "GOOGLE",
      providerAccountId: "google-account-123",
      refreshToken: "social-refresh-token",
    });
    expect(fixture.userRepository.profiles.get(result.id)).toEqual({
      name: "소셜 사용자",
      profileImage: "https://example.com/avatar.png",
    });
    expect(fixture.seeder.settings).toEqual([{ userId: result.id, consent }]);
    expect(fixture.seeder.categoryUserIds).toEqual([result.id]);
    expect(fixture.retentionEnroller.enrollments).toEqual([{ userId: result.id, activated: true }]);
  });
});
