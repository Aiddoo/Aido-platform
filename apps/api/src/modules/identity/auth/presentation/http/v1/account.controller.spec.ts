import type { CurrentUserPayload } from "#api/../../../packages/api/dist/contracts/auth/v1/auth.response.d";
import { ListLinkedAccountsUseCase } from "#api/modules/identity/auth/application/use-cases/list-linked-accounts.use-case";
import { UnlinkOAuthAccountUseCase } from "#api/modules/identity/auth/application/use-cases/unlink-oauth-account.use-case";
import { InMemoryAuthAccountRepository } from "#test/doubles/identity/in-memory-auth-account.repository";
import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";
import { createAuthAccountFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_USER_ID } from "#test/fixtures/identity/auth-session.fixture";

import { AccountController } from "./account.controller.js";

function createAccountController(accountRepository: InMemoryAuthAccountRepository) {
  const fixture = { ...createAuthCredentialFixture(), accountRepository };
  return new AccountController(
    new ListLinkedAccountsUseCase(fixture),
    new UnlinkOAuthAccountUseCase(fixture),
  );
}

describe("AccountController — 계정 컨트롤러", () => {
  it("연동 계정의 연결 시각은 출시 앱이 받던 ms 3자리 ISO 문자열로 응답한다", async () => {
    // Given
    const user: CurrentUserPayload = {
      userId: AUTH_FIXTURE_USER_ID,
      email: "user@example.com",
      sessionId: "session-123",
      role: "USER",
    };
    const controller = createAccountController(
      new InMemoryAuthAccountRepository([
        createAuthAccountFixture({ id: 1 }),
        createAuthAccountFixture({
          id: 2,
          provider: "GOOGLE",
          providerAccountId: "102938475647382910",
          password: null,
          createdAt: Temporal.Instant.from("2026-01-15T10:30:00Z"),
        }),
      ]),
    );

    // When
    const result = await controller.getLinkedAccounts(user);

    // Then
    expect(result.accounts.find((account) => account.provider === "GOOGLE")).toEqual({
      provider: "GOOGLE",
      linked: true,
      providerAccountId: "102938475647382910",
      linkedAt: "2026-01-15T10:30:00.000Z",
    });
    expect(result.canUnlink).toBe(true);
  });
});
