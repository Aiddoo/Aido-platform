import { OAUTH_PROVIDERS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { AccountFixture } from "#test/fixtures/user.fixture";

import { ListLinkedAccounts } from "./list-linked-accounts.use-case.js";

describe("ListLinkedAccounts — 로그인 수단과 소셜 연결 상태", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("Credential도 해제 가능 여부에 포함하고 모든 소셜 제공자를 고정 순서로 반환한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    fixture.accountRepository.accounts.push(
      AccountFixture.create({
        userId: fixture.user.id,
        provider: "GOOGLE",
        providerAccountId: "google-account",
      }),
    );
    fixture.accountRepository.accounts.push(
      AccountFixture.create({ userId: "other-user", provider: "APPLE" }),
    );
    // When
    const result = await new ListLinkedAccounts(fixture).execute({ userId: fixture.user.id });
    // Then
    expect(result.accounts.map((account) => account.provider)).toEqual(OAUTH_PROVIDERS);
    expect(result.accounts.find((account) => account.provider === "GOOGLE")).toEqual({
      provider: "GOOGLE",
      linked: true,
      providerAccountId: "google-account",
      linkedAt: AUTH_CREDENTIAL_TIME,
    });
    expect(
      result.accounts
        .filter((account) => account.provider !== "GOOGLE")
        .every(
          (account) =>
            !account.linked && account.providerAccountId === null && account.linkedAt === null,
        ),
    ).toBe(true);
    expect(result.canUnlink).toBe(true);
  });

  it("소셜 로그인 수단이 하나뿐이면 해제할 수 없고 다른 사용자의 수단은 세지 않는다", async () => {
    // Given
    const fixture = createAuthOAuthFixture("GOOGLE", { socialOnly: true });
    fixture.accountRepository.accounts.push(
      AccountFixture.create({ userId: "other-user", provider: "APPLE" }),
    );
    // When
    const result = await new ListLinkedAccounts(fixture).execute({ userId: fixture.user.id });
    // Then
    expect(result.canUnlink).toBe(false);
  });
});
