import { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import { InMemoryAuthAccountRepository } from "#test/doubles/identity/in-memory-auth-account.repository";
import { createAuthAccountFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/auth-session.fixture";

import { ListLinkedAccountsUseCase } from "./list-linked-accounts.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;

describe("ListLinkedAccounts — 로그인 수단과 소셜 연결 상태", () => {
  it("Credential도 해제 가능 여부에 포함하고 모든 소셜 제공자를 고정 순서로 반환한다", async () => {
    // Given
    const linkedAt = AUTH_FIXTURE_NOW.subtract({ hours: 24 });
    const accountRepository = new InMemoryAuthAccountRepository([
      createAuthAccountFixture({ id: 1, userId, provider: "CREDENTIAL" }),
      createAuthAccountFixture({
        id: 2,
        userId,
        provider: "GOOGLE",
        providerAccountId: "google-account",
        password: null,
        createdAt: linkedAt,
      }),
      createAuthAccountFixture({ id: 3, userId: "other-user", provider: "APPLE", password: null }),
    ]);
    // When
    const result = await new ListLinkedAccountsUseCase({ accountRepository }).execute({ userId });
    // Then
    expect(result.accounts.map((account) => account.provider)).toEqual(OAUTH_PROVIDERS);
    expect(result.accounts.find((account) => account.provider === "GOOGLE")).toEqual({
      provider: "GOOGLE",
      linked: true,
      providerAccountId: "google-account",
      linkedAt,
    });
    expect(
      result.accounts
        .filter((account) => account.provider !== "GOOGLE")
        .every(
          (account) =>
            !account.linked && account.providerAccountId == null && account.linkedAt == null,
        ),
    ).toBe(true);
    expect(result.canUnlink).toBe(true);
  });

  it("소셜 로그인 수단이 하나뿐이면 해제할 수 없고 다른 사용자의 수단은 세지 않는다", async () => {
    // Given
    const accountRepository = new InMemoryAuthAccountRepository([
      createAuthAccountFixture({ id: 1, userId, provider: "GOOGLE", password: null }),
      createAuthAccountFixture({ id: 2, userId: "other-user", provider: "APPLE", password: null }),
    ]);
    // When
    const result = await new ListLinkedAccountsUseCase({ accountRepository }).execute({ userId });
    // Then
    expect(result.canUnlink).toBe(false);
  });
});
