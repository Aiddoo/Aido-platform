import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";
import { HttpClient, HttpNetworkError } from "@nestjs/http-client";
import { type MockInstance, vi } from "vitest";

import type { OAuthTokenVerifier } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { FakeOAuthTokenVerifierService } from "#test/mocks/fake-oauth-token-verifier.service";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { GoogleOAuthProvider } from "./google.oauth-provider.js";
import { KakaoOAuthProvider } from "./kakao.oauth-provider.js";
import { NaverOAuthProvider } from "./naver.oauth-provider.js";

const SECRET_DESCRIPTION = "authorization code fixture-code-123 for user@example.com";

const config = () => ({
  clientId: "client-id",
  clientSecret: "client-secret",
  callbackUrl: "https://api.example.com/callback",
  isConfigured: true,
});

const providers = [
  { name: "KAKAO", create: KakaoOAuthProvider },
  { name: "GOOGLE", create: GoogleOAuthProvider },
  { name: "NAVER", create: NaverOAuthProvider },
] as const;

describe("OAuth 공급자 토큰 교환 로그", () => {
  let logger: Logger;
  let loggedError: MockInstance<Logger["error"]>;
  let fetch: MockInstance<typeof globalThis.fetch>;
  const verifier: OAuthTokenVerifier = new FakeOAuthTokenVerifierService();
  const http = new HttpClient({ retry: false, throwOnHttpError: false });
  let policies: OutboundPolicyRegistry;

  beforeEach(() => {
    policies = new OutboundPolicyRegistry(new RecordingOperationalAlert());
    logger = new Logger("test");
    loggedError = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    fetch = vi.spyOn(globalThis, "fetch");
  });

  it.each(providers)(
    "$name 교환이 거절되면 공급자·상태·짧은 오류 코드만 남기고 본문은 남기지 않는다",
    async ({ name, create }) => {
      // Given
      fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: SECRET_DESCRIPTION,
          }),
          { status: 400 },
        ),
      );
      const provider = new create(config, verifier, logger, http, policies);

      // When
      const exchange = provider.exchangeCode("fixture-code-123");

      // Then
      await expect(exchange).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
      expect(loggedError).toHaveBeenCalledWith({
        event: "identity.oauth.token-exchange.failed",
        provider: name,
        statusCode: 400,
        providerError: "invalid_grant",
      });
      expect(JSON.stringify(loggedError.mock.calls)).not.toContain("fixture-code-123");
      expect(JSON.stringify(loggedError.mock.calls)).not.toContain("user@example.com");
    },
  );

  it.each(providers)(
    "$name 교환은 연결이 끊겨도 다시 보내지 않고, 실패가 이어져도 다음 로그인을 막지 않는다",
    async ({ create }) => {
      // Given
      fetch.mockRejectedValue(new TypeError("fetch failed"));
      const provider = new create(config, verifier, logger, http, policies);

      // When
      const failures: unknown[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        failures.push(await provider.exchangeCode("code").catch((error: unknown) => error));
      }

      // Then
      expect(fetch).toHaveBeenCalledTimes(6);
      for (const failure of failures) {
        expect(failure).toBeInstanceOf(HttpNetworkError);
      }
    },
  );

  it("Kakao 오류 본문의 error_code(KOE)를 공급자 오류 코드로 쓴다", async () => {
    // Given
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant", error_code: "KOE320" }), {
        status: 400,
      }),
    );

    // When
    await new KakaoOAuthProvider(config, verifier, logger, http, policies)
      .exchangeCode("code")
      .catch(() => undefined);

    // Then
    expect(loggedError).toHaveBeenCalledWith(expect.objectContaining({ providerError: "KOE320" }));
  });

  it("JSON이 아닌 오류 본문은 공급자 오류 코드 없이 상태만 남긴다", async () => {
    // Given
    fetch.mockResolvedValue(new Response(`<html>${SECRET_DESCRIPTION}</html>`, { status: 502 }));

    // When
    await new GoogleOAuthProvider(config, verifier, logger, http, policies)
      .exchangeCode("code")
      .catch(() => undefined);

    // Then
    expect(loggedError).toHaveBeenCalledWith({
      event: "identity.oauth.token-exchange.failed",
      provider: "GOOGLE",
      statusCode: 502,
      providerError: undefined,
    });
    expect(JSON.stringify(loggedError.mock.calls)).not.toContain("user@example.com");
  });
});
