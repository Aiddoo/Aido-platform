import { mock } from "vitest-mock-extended";

import {
  CredentialAuthWorkflow,
  OAuthWorkflow,
  PasswordWorkflow,
} from "../../workflows/auth/index.js";
import { ExchangeOAuthCode } from "./exchange-oauth-code.use-case.js";
import { LoginWithPassword } from "./login-with-password.use-case.js";
import { GetCurrentUser } from "./queries.public.js";
import { Register } from "./register.use-case.js";
import { RequestPasswordReset } from "./request-password-reset.use-case.js";
import { SetPassword } from "./set-password.use-case.js";
import { StartOAuthAuthorization } from "./start-oauth-authorization.use-case.js";

describe("인증 endpoint UseCase", () => {
  it("인증 endpoint를 독립 실행 단위로 위임한다", async () => {
    const service = mock<CredentialAuthWorkflow>();
    const register = new Register({ workflow: service });
    const login = new LoginWithPassword({ workflow: service });
    const input: Parameters<CredentialAuthWorkflow["register"]>[0] = {
      email: "user@example.com",
      password: "Password123",
      passwordConfirm: "Password123",
      name: "사용자",
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
      marketingPushAgreed: false,
    };

    await register.execute(input);
    await login.execute({ email: input.email, password: input.password });

    expect(service.register).toHaveBeenCalledWith(input, undefined);
    expect(service.login).toHaveBeenCalledWith(
      { email: input.email, password: input.password },
      undefined,
    );
  });

  it("계정 query를 command와 분리한다", async () => {
    const service = mock<CredentialAuthWorkflow>();
    const currentUser = new GetCurrentUser({ workflow: service });

    await currentUser.execute("user-1", "user@example.com", "session-1");

    expect(service.getCurrentUser).toHaveBeenCalledWith("user-1", "user@example.com", "session-1");
  });

  it("비밀번호 endpoint를 독립 실행 단위로 위임한다", async () => {
    const service = mock<PasswordWorkflow>();
    const requestReset = new RequestPasswordReset({ workflow: service });
    const setPassword = new SetPassword({ workflow: service });

    await requestReset.execute("user@example.com");
    await setPassword.execute("user-1", "123456", "NewPassword123");

    expect(service.forgotPassword).toHaveBeenCalledWith("user@example.com", undefined);
    expect(service.setPassword).toHaveBeenCalledWith(
      "user-1",
      "123456",
      "NewPassword123",
      undefined,
    );
  });

  it.each([
    ["GOOGLE", "generateGoogleAuthUrlWithState"],
    ["KAKAO", "generateKakaoAuthUrlWithState"],
    ["NAVER", "generateNaverAuthUrlWithState"],
  ] as const)("%s OAuth 시작을 대응하는 workflow로 위임한다", async (provider, methodName) => {
    const service = mock<OAuthWorkflow>();
    const start = new StartOAuthAuthorization({ workflow: service });

    await start.execute(provider, "state");

    expect(service[methodName]).toHaveBeenCalledWith("state", undefined, undefined, undefined);
  });

  it("OAuth 교환 코드를 독립 실행 단위로 위임한다", async () => {
    const service = mock<OAuthWorkflow>();
    const exchange = new ExchangeOAuthCode({ workflow: service });

    await exchange.execute("exchange-code");

    expect(service.exchangeCodeForTokens).toHaveBeenCalledWith("exchange-code");
  });
});
