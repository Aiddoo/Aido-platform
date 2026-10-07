import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { OAuthStateFixture } from "#test/fixtures/oauth-state.fixture";

import { LinkOAuthAccountWithCode } from "./link-oauth-account-with-code.use-case.js";

describe("LinkOAuthAccountWithCode — 사용자에게 귀속된 일회용 연결 코드", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());
  function given(overrides: Parameters<typeof OAuthStateFixture.create>[0] = {}) {
    const fixture = createAuthOAuthFixture();
    const state = OAuthStateFixture.create({
      mode: "link",
      exchangeCode: "link-code",
      userId: "provider-account",
      initiatingUserId: fixture.user.id,
      ...overrides,
    });
    fixture.oauthStateRepository.states.set(state.id, state);
    return { ...fixture, state, useCase: new LinkOAuthAccountWithCode(fixture) };
  }

  it.each([null, "", "credential-user"])(
    "레거시 actor %s 코드도 소비해 신원을 연결하고 커밋 후 캐시를 제거한다",
    async (initiatingUserId) => {
      // Given
      const fixture = given({ initiatingUserId });
      fixture.cacheService.userIds.add(fixture.user.id);
      fixture.unitOfWork.run = async <T>(work: () => Promise<T>): Promise<T> => {
        const result = await work();
        expect(fixture.oauthStateRepository.states.get(fixture.state.id)?.exchangedAt).toEqual(
          AUTH_CREDENTIAL_TIME,
        );
        expect(fixture.securityLogRepository.entries).toHaveLength(1);
        expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
        return result;
      };
      // When
      const result = await fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" });
      // Then
      expect(result.message).toBe("계정이 연결되었습니다.");
      expect(
        await fixture.accountRepository.findByProviderAccountId("GOOGLE", "provider-account"),
      ).toMatchObject({ userId: fixture.user.id });
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
      await expect(
        fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    },
  );

  it.each([
    { description: "다른 사용자", overrides: { initiatingUserId: "other-user" } },
    { description: "로그인 용도", overrides: { mode: "login" } },
    { description: "신원 ID 없음", overrides: { userId: null } },
    { description: "신원 ID 비어 있음", overrides: { userId: "" } },
    { description: "만료 경계", overrides: { expiresAt: AUTH_CREDENTIAL_TIME } },
  ])("$description: 코드 소비와 연결 전에 거부한다", async ({ overrides }) => {
    // Given
    const fixture = given(overrides);
    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.oauthStateRepository.states.get(fixture.state.id)?.exchangedAt).toBeNull();
    expect(fixture.accountRepository.accounts).toHaveLength(1);
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
      fixture.accountRepository.accounts.filter((account) => account.provider === "GOOGLE"),
    ).toHaveLength(1);
    expect(fixture.securityLogRepository.entries).toHaveLength(1);
  });

  it("감사 저장 실패를 호출자에게 전달하며 성공 캐시 무효화를 실행하지 않는다", async () => {
    // Given
    const fixture = given();
    fixture.cacheService.userIds.add(fixture.user.id);
    const auditError = new Error("감사 저장 실패");
    vi.spyOn(fixture.securityLogRepository, "create").mockRejectedValueOnce(auditError);
    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, code: "link-code" });
    // Then
    await expect(pending).rejects.toBe(auditError);
    expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(true);
  });
});
