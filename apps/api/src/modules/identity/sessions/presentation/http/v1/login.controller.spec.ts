import type { CurrentUserPayload } from "@aido/api/contracts/auth";

import { LoginWithPasswordUseCase } from "#api/modules/identity/sessions/application/use-cases/login-with-password.use-case";
import { LogoutAllUseCase } from "#api/modules/identity/sessions/application/use-cases/logout-all.use-case";
import { LogoutUseCase } from "#api/modules/identity/sessions/application/use-cases/logout.use-case";
import { RefreshTokensUseCase } from "#api/modules/identity/sessions/application/use-cases/refresh-tokens.use-case";
import { VerifyEmailUseCase } from "#api/modules/identity/sessions/application/use-cases/verify-email.use-case";
import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";
import { createSessionFixture } from "#test/fixtures/identity/session.fixture";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import { LoginController } from "./login.controller.js";

function createLoginController(fixture: ReturnType<typeof createAuthCredentialFixture>) {
  return new LoginController(
    new VerifyEmailUseCase(fixture),
    new LoginWithPasswordUseCase(fixture),
    new LogoutUseCase(fixture),
    new LogoutAllUseCase(fixture),
    new RefreshTokensUseCase(fixture),
  );
}

describe("LoginController — 로그인 컨트롤러", () => {
  it("전체 로그아웃은 출시 앱이 받던 안내 문구만 응답한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    fixture.sessionRepository.seed(createSessionFixture({ userId: fixture.user.id }));
    const user: CurrentUserPayload = {
      userId: fixture.user.id,
      email: fixture.user.email,
      sessionId: "session-123",
      role: "USER",
    };
    const source = {
      ip: undefined,
      userAgent: "test-agent",
      acceptLanguage: undefined,
      client: parseRequestClient({ "user-agent": "test-agent" }, TEST_REQUEST_ID),
    };

    // When
    const result = await createLoginController(fixture).logoutAll(user, source);

    // Then
    expect(result).toEqual({ message: "모든 기기에서 로그아웃되었습니다." });
  });
});
