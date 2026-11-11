import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

import express, { type Request } from "express";

import type { CurrentUserPayload } from "#api/../../../packages/api/dist/contracts/auth/v1/auth.response.d";
import { ChangePasswordUseCase } from "#api/modules/identity/auth/application/use-cases/change-password.use-case";
import { LoginWithPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-password.use-case";
import { LogoutAllUseCase } from "#api/modules/identity/auth/application/use-cases/logout-all.use-case";
import { LogoutUseCase } from "#api/modules/identity/auth/application/use-cases/logout.use-case";
import { RefreshTokensUseCase } from "#api/modules/identity/auth/application/use-cases/refresh-tokens.use-case";
import { RegisterUseCase } from "#api/modules/identity/auth/application/use-cases/register.use-case";
import { RequestPasswordResetUseCase } from "#api/modules/identity/auth/application/use-cases/request-password-reset.use-case";
import { RequestPasswordSetupCodeUseCase } from "#api/modules/identity/auth/application/use-cases/request-password-setup-code.use-case";
import { ResendVerificationUseCase } from "#api/modules/identity/auth/application/use-cases/resend-verification.use-case";
import { ResetPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/reset-password.use-case";
import { SetPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/set-password.use-case";
import { VerifyEmailUseCase } from "#api/modules/identity/auth/application/use-cases/verify-email.use-case";
import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";
import { createAuthSessionFixture } from "#test/fixtures/identity/auth-session.fixture";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import { AuthController } from "./auth.controller.js";

function createAuthController(fixture: ReturnType<typeof createAuthCredentialFixture>) {
  return new AuthController(
    new RegisterUseCase(fixture),
    new VerifyEmailUseCase(fixture),
    new ResendVerificationUseCase(fixture),
    new LoginWithPasswordUseCase(fixture),
    new LogoutUseCase(fixture),
    new LogoutAllUseCase(fixture),
    new RefreshTokensUseCase(fixture),
    new RequestPasswordResetUseCase(fixture),
    new ResetPasswordUseCase(fixture),
    new RequestPasswordSetupCodeUseCase(fixture),
    new SetPasswordUseCase(fixture),
    new ChangePasswordUseCase(fixture),
  );
}

// 컨트롤러가 express Request를 받아 실제 express 앱이 만든 요청 객체를 쓴다
function createExpressRequest(headers: IncomingMessage["headers"]): Promise<Request> {
  const incoming = new IncomingMessage(new Socket());
  incoming.method = "POST";
  incoming.url = "/";
  incoming.headers = headers;
  const app = express();
  return new Promise((resolve) => {
    app.use((request: Request) => resolve(request));
    app(incoming, new ServerResponse(incoming));
  });
}

describe("AuthController — 인증 컨트롤러", () => {
  it("전체 로그아웃은 출시 앱이 받던 안내 문구만 응답한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    await fixture.sessionRepository.save(createAuthSessionFixture({ userId: fixture.user.id }));
    const user: CurrentUserPayload = {
      userId: fixture.user.id,
      email: fixture.user.email,
      sessionId: "session-123",
      role: "USER",
    };
    const headers = { "user-agent": "test-agent" };
    const request = await createExpressRequest(headers);

    // When
    const result = await createAuthController(fixture).logoutAll(
      user,
      request,
      parseRequestClient(headers, TEST_REQUEST_ID),
    );

    // Then
    expect(result).toEqual({ message: "모든 기기에서 로그아웃되었습니다." });
  });
});
