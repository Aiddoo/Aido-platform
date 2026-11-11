import {
  AUTH_CREDENTIAL_NOW,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

describe("ProvisionUser — 신규 계정과 기본 설정 생성", () => {
  it("이메일 계정은 미인증 상태로 계정·프로필·동의와 기본 설정을 생성한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ empty: true });
    const consent = { termsAgreedAt: AUTH_CREDENTIAL_NOW };

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
    expect(fixture.userRepository.stored(result.id)).toMatchObject({
      email: result.email,
      status: "PENDING_VERIFY",
      emailVerifiedAt: null,
    });
    expect(fixture.accountRepository.all).toEqual([
      expect.objectContaining({
        userId: result.id,
        provider: "CREDENTIAL",
        password: "digest:password",
      }),
    ]);
    expect(fixture.userRepository.profileOf(result.id)).toEqual({
      name: "신규 사용자",
      profileImage: null,
    });
    expect(fixture.seeder.settings).toEqual([{ userId: result.id, consent }]);
    expect(fixture.seeder.categoryUserIds).toEqual([result.id]);
    expect(fixture.retentionEnroller.enrollments).toEqual([
      { userId: result.id, activated: false },
    ]);
  });

  it("OAuth 계정은 검증 시각·프로필·동의를 보존하고 활성 사용자로 실험에 등록한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture({ empty: true });
    const consent = {
      termsAgreedAt: AUTH_CREDENTIAL_NOW,
      privacyAgreedAt: AUTH_CREDENTIAL_NOW,
      marketingAgreedAt: AUTH_CREDENTIAL_NOW,
    };

    // When
    const result = await fixture.provisionUserUseCase.execute({
      email: "social@example.com",
      status: "ACTIVE",
      emailVerifiedAt: AUTH_CREDENTIAL_NOW,
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
    expect(fixture.userRepository.stored(result.id)).toMatchObject({
      email: "social@example.com",
      status: "ACTIVE",
      emailVerifiedAt: AUTH_CREDENTIAL_NOW,
    });
    expect(fixture.accountRepository.all).toEqual([
      expect.objectContaining({
        userId: result.id,
        provider: "GOOGLE",
        providerAccountId: "google-account-123",
        password: null,
      }),
    ]);
    expect(fixture.userRepository.profileOf(result.id)).toEqual({
      name: "소셜 사용자",
      profileImage: "https://example.com/avatar.png",
    });
    expect(fixture.seeder.settings).toEqual([{ userId: result.id, consent }]);
    expect(fixture.seeder.categoryUserIds).toEqual([result.id]);
    expect(fixture.retentionEnroller.enrollments).toEqual([{ userId: result.id, activated: true }]);
  });
});
