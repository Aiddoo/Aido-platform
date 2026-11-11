import { ErrorCode } from "@aido/api/errors";

import type { AuthOAuthStatePrimitives } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { InMemoryAuthOAuthStateRepository } from "#test/doubles/identity/in-memory-auth-oauth-state.repository";
import { AUTH_CREDENTIAL_NOW } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { createAuthOAuthStateFixture } from "#test/fixtures/identity/auth-credential.fixture";

import { LinkOAuthAccountWithCodeUseCase } from "./link-oauth-account-with-code.use-case.js";
import { LinkOAuthIdentityUseCase } from "./link-oauth-identity.use-case.js";

// 작업이 끝난 커밋 시점의 상태를 남겨 커밋 뒤에 할 일이 트랜잭션 안에서 실행되지 않았는지 본다
class CommitProbeUnitOfWork<T> extends UnitOfWorkPort {
  readonly observed: T[] = [];
  readonly #probe: () => T;

  constructor(probe: () => T) {
    super();
    this.#probe = probe;
  }

  async run<R>(work: () => Promise<R>): Promise<R> {
    const result = await work();
    this.observed.push(this.#probe());
    return result;
  }
}

describe("LinkOAuthAccountWithCode — 사용자에게 귀속된 일회용 연결 코드", () => {
  function given(overrides: Partial<AuthOAuthStatePrimitives> = {}) {
    const fixture = createAuthOAuthFixture();
    const state = createAuthOAuthStateFixture({
      mode: "link",
      exchangeCode: "link-code",
      userId: "provider-account",
      initiatingUserId: fixture.user.id,
      ...overrides,
    });
    const oauthStateRepository = new InMemoryAuthOAuthStateRepository([state]);
    return {
      ...fixture,
      oauthStateRepository,
      storedState: () => oauthStateRepository.all.find(({ id }) => id === state.id.value),
      useCase: new LinkOAuthAccountWithCodeUseCase({ ...fixture, oauthStateRepository }),
    };
  }

  it.each([null, "", "credential-user"])(
    "시작 사용자 %s(user_hint를 보내지 않은 출시 앱 포함) 코드도 소비해 신원을 연결하고 커밋 후 캐시를 제거한다",
    async (initiatingUserId) => {
      // Given
      const fixture = given({ initiatingUserId });
      fixture.cacheService.userIds.add(fixture.user.id);
      const unitOfWork = new CommitProbeUnitOfWork(() => ({
        exchangedAt: fixture.storedState()?.exchangedAt,
        auditCount: fixture.securityLogRepository.entries.length,
        cached: fixture.cacheService.userIds.has(fixture.user.id),
      }));
      const useCase = new LinkOAuthAccountWithCodeUseCase({ ...fixture, unitOfWork });
      // When
      const result = await useCase.execute({ userId: fixture.user.id, code: "link-code" });
      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");
      expect(unitOfWork.observed).toEqual([
        { exchangedAt: AUTH_CREDENTIAL_NOW, auditCount: 1, cached: true },
      ]);
      expect(
        await fixture.accountRepository.findByProviderAccountId("GOOGLE", "provider-account"),
      ).toMatchObject({ userId: fixture.user.id });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
      await expect(
        useCase.execute({ userId: fixture.user.id, code: "link-code" }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    },
  );

  it.each([
    { description: "다른 사용자", overrides: { initiatingUserId: "other-user" } },
    { description: "로그인 용도", overrides: { mode: "login" } },
    { description: "신원 ID 없음", overrides: { userId: null } },
    { description: "신원 ID 비어 있음", overrides: { userId: "" } },
    { description: "만료 경계", overrides: { expiresAt: AUTH_CREDENTIAL_NOW } },
  ])("$description: 코드 소비와 연결 전에 거부한다", async ({ overrides }) => {
    // Given
    const fixture = given(overrides);
    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.storedState()?.exchangedAt).toBeNull();
    expect(fixture.accountRepository.all).toHaveLength(1);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("같은 연결 코드의 동시 소비는 신원·감사 기록을 한 번만 만든다", async () => {
    // Given
    const fixture = given();
    // When
    const results = await Promise.allSettled([
      fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" }),
      fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" }),
    ]);
    // Then
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: { errorCode: ErrorCode.USER_0602 } },
    ]);
    expect(
      fixture.accountRepository.all.filter((account) => account.provider === "GOOGLE"),
    ).toHaveLength(1);
    expect(fixture.securityLogRepository.entries).toHaveLength(1);
  });

  it("감사 저장 실패를 호출자에게 전달하며 성공 캐시 무효화를 실행하지 않는다", async () => {
    // Given
    const fixture = given();
    fixture.cacheService.userIds.add(fixture.user.id);
    const auditError = new Error("감사 저장 실패");
    const linkOAuthIdentity = new LinkOAuthIdentityUseCase({
      accountRepository: fixture.accountRepository,
      securityLogRepository: {
        create: async () => {
          throw auditError;
        },
      },
    });
    // When
    const pending = new LinkOAuthAccountWithCodeUseCase({ ...fixture, linkOAuthIdentity }).execute({
      userId: fixture.user.id,
      code: "link-code",
    });
    // Then
    await expect(pending).rejects.toBe(auditError);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
  });
});
