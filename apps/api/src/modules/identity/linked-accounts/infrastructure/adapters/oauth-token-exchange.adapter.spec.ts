import { ErrorCode } from "@aido/api/errors";
import { Logger, type LoggerService } from "@nestjs/common";
import { HttpClient, HttpNetworkError } from "@nestjs/http-client";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { GoogleOAuthIdentityAdapter } from "./google-oauth-identity.adapter.js";
import { KakaoOAuthIdentityAdapter } from "./kakao-oauth-identity.adapter.js";
import { NaverOAuthIdentityAdapter } from "./naver-oauth-identity.adapter.js";

const SECRET_DESCRIPTION = "authorization code fixture-code-123 for user@example.com";

const client = {
  clientId: "client-id",
  clientSecret: "client-secret",
  callbackUrl: "https://api.example.com/callback",
  isConfigured: true,
};
const config = {
  google: client,
  kakao: client,
  naver: client,
  apple: { clientId: undefined, jwksUrl: undefined, jwksCooldownDurationMs: undefined },
};

const providers = [
  { name: "KAKAO", create: KakaoOAuthIdentityAdapter },
  { name: "GOOGLE", create: GoogleOAuthIdentityAdapter },
  { name: "NAVER", create: NaverOAuthIdentityAdapter },
] as const;

// 어댑터가 Nest Logger를 직접 만들어 정적 logger 자리에 둔다(vitest는 spec 파일마다 모듈을 새로 읽는다)
class RecordingNestLogger implements LoggerService {
  readonly errors: unknown[] = [];
  readonly others: unknown[] = [];

  log(message: unknown): void {
    this.others.push(message);
  }

  warn(message: unknown): void {
    this.others.push(message);
  }

  debug(message: unknown): void {
    this.others.push(message);
  }

  error(message: unknown): void {
    this.errors.push(message);
  }
}

class ProviderFetch {
  readonly requests: Request[] = [];
  #reply: () => Promise<Response> = async () => new Response(null, { status: 500 });

  respondWith(createResponse: () => Response): void {
    this.#reply = async () => createResponse();
  }

  failWith(error: Error): void {
    this.#reply = async () => {
      throw error;
    };
  }

  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    this.requests.push(new Request(input, init));
    return this.#reply();
  };
}

describe("OAuth 공급자 토큰 교환 로그", () => {
  let logs: RecordingNestLogger;
  let providerFetch: ProviderFetch;
  let http: HttpClient;
  let policies: OutboundPolicyRegistry;

  beforeEach(() => {
    logs = new RecordingNestLogger();
    Logger.overrideLogger(logs);
    providerFetch = new ProviderFetch();
    http = new HttpClient({ retry: false, throwOnHttpError: false, fetch: providerFetch.fetch });
    policies = new OutboundPolicyRegistry(new RecordingOperationalAlert());
  });

  it.each(providers)(
    "$name 교환이 거절되면 공급자·상태·짧은 오류 코드만 남기고 본문은 남기지 않는다",
    async ({ name, create }) => {
      // Given
      providerFetch.respondWith(
        () =>
          new Response(
            JSON.stringify({ error: "invalid_grant", error_description: SECRET_DESCRIPTION }),
            { status: 400 },
          ),
      );
      const provider = new create(config, http, policies);

      // When
      const exchange = provider.exchangeCode("fixture-code-123");

      // Then
      await expect(exchange).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
      expect(logs.errors).toContainEqual({
        event: "identity.oauth.token-exchange.failed",
        provider: name,
        statusCode: 400,
        providerError: "invalid_grant",
      });
      const logged = JSON.stringify([logs.errors, logs.others]);
      expect(logged).not.toContain("fixture-code-123");
      expect(logged).not.toContain("user@example.com");
    },
  );

  it.each(providers)(
    "$name 교환은 연결이 끊겨도 다시 보내지 않고, 실패가 이어져도 다음 로그인을 막지 않는다",
    async ({ create }) => {
      // Given
      providerFetch.failWith(new TypeError("fetch failed"));
      const provider = new create(config, http, policies);

      // When
      const failures: unknown[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        failures.push(await provider.exchangeCode("code").catch((error: unknown) => error));
      }

      // Then
      expect(providerFetch.requests).toHaveLength(6);
      for (const failure of failures) {
        expect(failure).toBeInstanceOf(HttpNetworkError);
      }
    },
  );

  it("Kakao 오류 본문의 error_code(KOE)를 공급자 오류 코드로 쓴다", async () => {
    // Given
    providerFetch.respondWith(
      () =>
        new Response(JSON.stringify({ error: "invalid_grant", error_code: "KOE320" }), {
          status: 400,
        }),
    );

    // When
    await new KakaoOAuthIdentityAdapter(config, http, policies)
      .exchangeCode("code")
      .catch(() => undefined);

    // Then
    expect(logs.errors).toContainEqual(expect.objectContaining({ providerError: "KOE320" }));
  });

  it("JSON이 아닌 오류 본문은 공급자 오류 코드 없이 상태만 남긴다", async () => {
    // Given
    providerFetch.respondWith(
      () => new Response(`<html>${SECRET_DESCRIPTION}</html>`, { status: 502 }),
    );

    // When
    await new GoogleOAuthIdentityAdapter(config, http, policies)
      .exchangeCode("code")
      .catch(() => undefined);

    // Then
    expect(logs.errors).toContainEqual({
      event: "identity.oauth.token-exchange.failed",
      provider: "GOOGLE",
      statusCode: 502,
      providerError: undefined,
    });
    expect(JSON.stringify([logs.errors, logs.others])).not.toContain("user@example.com");
  });
});
