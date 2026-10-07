import { mock } from "vitest-mock-extended";

import { OAuthWorkflow } from "../../workflows/auth/index.js";
import { ExchangeOAuthCode } from "./exchange-oauth-code.use-case.js";
import { StartOAuthAuthorization } from "./start-oauth-authorization.use-case.js";

describe("인증 endpoint UseCase", () => {
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
