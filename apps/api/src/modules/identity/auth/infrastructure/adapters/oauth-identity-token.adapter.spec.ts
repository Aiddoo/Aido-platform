import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

import { ErrorCode } from "@aido/api/errors";
import { Logger, type LoggerService } from "@nestjs/common";
import { HttpClient } from "@nestjs/http-client";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { vi } from "vitest";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import { AppleOAuthIdentityAdapter } from "./apple-oauth-identity.adapter.js";
import { GoogleOAuthIdentityAdapter } from "./google-oauth-identity.adapter.js";
import { KakaoOAuthIdentityAdapter } from "./kakao-oauth-identity.adapter.js";
import { NaverOAuthIdentityAdapter } from "./naver-oauth-identity.adapter.js";
import { OAUTH_PROVIDER_TIMEOUT_MS } from "./oauth-outbound.policy.js";

const googleIdTokens = vi.hoisted(() => ({
  clientOptions: new Array<unknown>(),
  verifications: new Array<unknown>(),
  verify: (): Promise<{ getPayload(): unknown }> =>
    Promise.reject(new Error("verifyIdToken 응답을 정하지 않았다")),
}));

// 어댑터가 OAuth2Client를 직접 만들고 라이브러리는 node-fetch로 Google 공개키를 받아 모듈 경계를 손으로 쓴 대역으로 바꾼다
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    constructor(options: unknown) {
      googleIdTokens.clientOptions.push(options);
    }

    verifyIdToken(options: unknown) {
      googleIdTokens.verifications.push(options);
      return googleIdTokens.verify();
    }
  },
}));

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
  #replies: Array<() => Promise<Response>> = [];

  respondWith(...createResponses: Array<() => Response>): void {
    this.#replies = createResponses.map((createResponse) => async () => createResponse());
  }

  failWith(error: Error): void {
    this.#replies = [
      async () => {
        throw error;
      },
    ];
  }

  // 마지막 응답은 이후 요청에도 계속 쓴다
  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    this.requests.push(new Request(input, init));
    const reply = this.#replies.length > 1 ? this.#replies.shift() : this.#replies[0];
    if (reply == null) {
      throw new Error("공급자 응답을 정하지 않았다");
    }
    return reply();
  };
}

function jsonResponse(body: unknown, status = 200): () => Response {
  return () => new Response(JSON.stringify(body), { status });
}

function emptyResponse(status: number): () => Response {
  return () => new Response(null, { status });
}

const oauthClient = {
  clientId: "google-client-id",
  clientSecret: "client-secret",
  callbackUrl: "https://api.example.com/callback",
  isConfigured: true,
};

function oauthConfig(appleJwksUrl?: string) {
  return {
    google: oauthClient,
    kakao: oauthClient,
    naver: oauthClient,
    apple: {
      clientId: "apple-client-id",
      jwksUrl: appleJwksUrl,
      jwksCooldownDurationMs: appleJwksUrl == null ? undefined : 0,
    },
  };
}

describe("OAuth 공급자 어댑터 — 앱이 보낸 공급자 토큰 검증", () => {
  let logs: RecordingNestLogger;
  let providerFetch: ProviderFetch;
  let google: GoogleOAuthIdentityAdapter;
  let kakao: KakaoOAuthIdentityAdapter;
  let naver: NaverOAuthIdentityAdapter;

  beforeEach(() => {
    logs = new RecordingNestLogger();
    Logger.overrideLogger(logs);
    googleIdTokens.clientOptions.length = 0;
    googleIdTokens.verifications.length = 0;
    providerFetch = new ProviderFetch();
    const http = new HttpClient({
      retry: false,
      throwOnHttpError: false,
      fetch: providerFetch.fetch,
    });
    const policies = new OutboundPolicyRegistry(new RecordingOperationalAlert());
    google = new GoogleOAuthIdentityAdapter(oauthConfig(), http, policies);
    kakao = new KakaoOAuthIdentityAdapter(oauthConfig(), http, policies);
    naver = new NaverOAuthIdentityAdapter(oauthConfig(), http, policies);
  });

  it("Google 공개키 조회에도 OAuth 공급자 시간 제한을 건다", () => {
    // Given
    const created = googleIdTokens.clientOptions;

    // When
    const options = created.at(-1);

    // Then
    expect(options).toMatchObject({
      transporterOptions: { timeout: OAUTH_PROVIDER_TIMEOUT_MS },
    });
  });

  describe("Google ID Token 검증", () => {
    const validGooglePayload = {
      sub: "google-user-123",
      email: "test@gmail.com",
      email_verified: true,
      name: "홍길동",
      picture: "https://lh3.googleusercontent.com/photo.jpg",
    };

    it("유효한 Google ID Token을 검증하면 프로필을 반환한다", async () => {
      // Given
      googleIdTokens.verify = async () => ({ getPayload: () => validGooglePayload });

      // When
      const result = await google.verifyToken("valid-google-token");

      // Then
      expect(result).toEqual({
        id: "google-user-123",
        email: "test@gmail.com",
        emailVerified: true,
        name: "홍길동",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
      });
      expect(googleIdTokens.verifications).toEqual([
        { idToken: "valid-google-token", audience: "google-client-id" },
      ]);
    });

    it("이메일이 없는 Google 프로필도 처리한다", async () => {
      // Given
      googleIdTokens.verify = async () => ({
        getPayload: () => ({ sub: "google-user-456", email_verified: false }),
      });

      // When
      const result = await google.verifyToken("valid-token");

      // Then
      expect(result).toEqual({
        id: "google-user-456",
        email: null,
        emailVerified: false,
        name: undefined,
        picture: undefined,
      });
    });

    it("payload가 없으면 에러를 발생시킨다", async () => {
      // Given
      googleIdTokens.verify = async () => ({ getPayload: () => null });

      // When
      const verification = google.verifyToken("invalid-token");

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "GOOGLE" },
      });
    });

    it("만료된 토큰은 socialTokenExpired 에러를 발생시킨다", async () => {
      // Given
      const sensitiveSubject = "google-user-123";
      googleIdTokens.verify = () =>
        Promise.reject(new Error(`Token used too late, 100 > 90: {"sub":"${sensitiveSubject}"}`));

      // When
      const verification = google.verifyToken("expired-token");

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0203,
        details: { provider: "GOOGLE" },
      });
      expect(logs.errors).toEqual([
        {
          event: "identity.oauth.token-verify.failed",
          provider: "GOOGLE",
          reason: "expired",
          errorType: "Error",
        },
      ]);
      expect(JSON.stringify([logs.errors, logs.others])).not.toContain(sensitiveSubject);
    });

    it("audience가 다른 토큰은 socialTokenInvalid 에러를 발생시킨다", async () => {
      // Given
      googleIdTokens.verify = () =>
        Promise.reject(new Error("Wrong recipient, payload audience != requiredAudience"));

      // When
      const verification = google.verifyToken("wrong-audience-token");

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "GOOGLE" },
      });
    });

    it("잘못된 토큰은 socialTokenInvalid 에러를 발생시킨다", async () => {
      // Given
      googleIdTokens.verify = () => Promise.reject(new Error("Invalid signature"));

      // When
      const verification = google.verifyToken("malformed-token");

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "GOOGLE" },
      });
    });
  });

  describe("Kakao Access Token 검증", () => {
    const kakaoUser = {
      id: 12_345_678,
      kakao_account: {
        email: "test@kakao.com",
        is_email_verified: true,
        profile: {
          nickname: "카카오유저",
          profile_image_url: "https://k.kakaocdn.net/dn/profile.jpg",
        },
      },
    };

    it("유효한 Kakao access token을 검증하면 프로필을 반환한다", async () => {
      // Given
      providerFetch.respondWith(jsonResponse(kakaoUser));

      // When
      const result = await kakao.verifyToken("valid-kakao-token");

      // Then
      expect(result).toEqual({
        id: "12345678",
        email: "test@kakao.com",
        emailVerified: true,
        name: "카카오유저",
        picture: "https://k.kakaocdn.net/dn/profile.jpg",
      });
      const [request] = providerFetch.requests;
      expect(request?.url).toBe("https://kapi.kakao.com/v2/user/me?secure_resource=true");
      expect(request?.headers.get("authorization")).toBe("Bearer valid-kakao-token");
      expect(request?.headers.get("content-type")).toBe(
        "application/x-www-form-urlencoded;charset=utf-8",
      );
    });

    it("이메일이 없는 Kakao 계정도 처리한다", async () => {
      // Given
      providerFetch.respondWith(
        jsonResponse({ id: 87_654_321, kakao_account: { profile: { nickname: "닉네임만" } } }),
      );

      // When
      const result = await kakao.verifyToken("valid-token");

      // Then
      expect(result.email).toBeNull();
      expect(result.emailVerified).toBe(false);
    });

    it("401 응답은 socialTokenExpired 에러를 발생시킨다", async () => {
      // Given
      providerFetch.respondWith(emptyResponse(401));

      // When
      const verification = kakao.verifyToken("expired-token");

      // Then
      await expect(verification).rejects.toMatchObject({ errorCode: ErrorCode.SOCIAL_0203 });
    });

    it("검증 성공·실패 로그에 공급자 사용자 ID와 오류 원문을 남기지 않는다", async () => {
      // Given
      providerFetch.respondWith(jsonResponse(kakaoUser), emptyResponse(401));

      // When
      await kakao.verifyToken("valid-kakao-token");
      await kakao.verifyToken("expired-token").catch(() => undefined);

      // Then
      expect(logs.errors).toEqual([
        {
          event: "identity.oauth.token-verify.failed",
          provider: "KAKAO",
          errorType: "ApplicationException",
          errorCode: ErrorCode.SOCIAL_0203,
        },
      ]);
      const logged = JSON.stringify([logs.errors, logs.others]);
      expect(logged).not.toContain(String(kakaoUser.id));
      expect(logged).not.toContain("test@kakao.com");
    });

    it("기타 에러 응답은 socialTokenInvalid 에러를 발생시킨다", async () => {
      // Given
      providerFetch.respondWith(emptyResponse(400));

      // When
      const verification = kakao.verifyToken("invalid-token");

      // Then
      await expect(verification).rejects.toMatchObject({ errorCode: ErrorCode.SOCIAL_0202 });
    });

    it("연결 실패가 이어져도 오류 코드는 그대로이고 공급자가 돌아오면 바로 로그인된다", async () => {
      // Given
      providerFetch.failWith(new TypeError("fetch failed"));
      const failures: unknown[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        failures.push(await kakao.verifyToken("token").catch((error: unknown) => error));
      }
      providerFetch.respondWith(jsonResponse(kakaoUser));

      // When
      const profile = await kakao.verifyToken("token");

      // Then
      for (const failure of failures) {
        expect(failure).toMatchObject({ errorCode: ErrorCode.SOCIAL_0202 });
      }
      expect(providerFetch.requests).toHaveLength(7);
      expect(profile.id).toBe(String(kakaoUser.id));
    });
  });

  describe("Naver Access Token 검증", () => {
    const naverUser = {
      resultcode: "00",
      message: "success",
      response: {
        id: "naver-user-123",
        email: "test@naver.com",
        name: "네이버유저",
        nickname: "네이버닉네임",
        profile_image: "https://phinf.pstatic.net/profile.jpg",
      },
    };

    it("유효한 Naver access token을 검증하면 프로필을 반환한다", async () => {
      // Given
      providerFetch.respondWith(jsonResponse(naverUser));

      // When
      const result = await naver.verifyToken("valid-naver-token");

      // Then
      expect(result).toEqual({
        id: "naver-user-123",
        email: "test@naver.com",
        emailVerified: false,
        name: "네이버유저",
        picture: "https://phinf.pstatic.net/profile.jpg",
      });
      const [request] = providerFetch.requests;
      expect(request?.url).toBe("https://openapi.naver.com/v1/nid/me");
      expect(request?.headers.get("authorization")).toBe("Bearer valid-naver-token");
    });

    it("이름이 없으면 닉네임을 사용한다", async () => {
      // Given
      providerFetch.respondWith(
        jsonResponse({
          resultcode: "00",
          message: "success",
          response: { id: "naver-user-456", nickname: "닉네임만" },
        }),
      );

      // When
      const result = await naver.verifyToken("valid-token");

      // Then
      expect(result.name).toBe("닉네임만");
    });

    it("이메일이 없으면 emailVerified는 false이다", async () => {
      // Given
      providerFetch.respondWith(
        jsonResponse({
          resultcode: "00",
          message: "success",
          response: { id: "naver-user-789", name: "이름만" },
        }),
      );

      // When
      const result = await naver.verifyToken("valid-token");

      // Then
      expect(result.email).toBeNull();
      expect(result.emailVerified).toBe(false);
    });

    it("401 응답은 socialTokenExpired 에러를 발생시킨다", async () => {
      // Given
      providerFetch.respondWith(emptyResponse(401));

      // When
      const verification = naver.verifyToken("expired-token");

      // Then
      await expect(verification).rejects.toMatchObject({ errorCode: ErrorCode.SOCIAL_0203 });
    });

    it("resultcode가 00이 아니면 에러를 발생시킨다", async () => {
      // Given
      providerFetch.respondWith(jsonResponse({ resultcode: "01", message: "error" }));

      // When
      const verification = naver.verifyToken("invalid-token");

      // Then
      await expect(verification).rejects.toMatchObject({ errorCode: ErrorCode.SOCIAL_0202 });
    });

    it("response가 없으면 에러를 발생시킨다", async () => {
      // Given
      providerFetch.respondWith(jsonResponse({ resultcode: "00", message: "success" }));

      // When
      const verification = naver.verifyToken("invalid-token");

      // Then
      await expect(verification).rejects.toMatchObject({ errorCode: ErrorCode.SOCIAL_0202 });
    });
  });

  describe("Apple ID Token 검증", () => {
    const keyIds = {
      first: "apple-key-1",
      second: "apple-key-2",
    } as const;
    let keyPairs: {
      first: Awaited<ReturnType<typeof generateKeyPair>>;
      second: Awaited<ReturnType<typeof generateKeyPair>>;
    };
    let publicJwks: { first: JWK; second: JWK };
    let activeJwks: JWK[];
    let jwksServer: Server;
    let jwksUrl: string;
    let requestCount: number;
    let apple: AppleOAuthIdentityAdapter;

    beforeAll(async () => {
      const [firstKeyPair, secondKeyPair] = await Promise.all([
        generateKeyPair("RS256", { extractable: true }),
        generateKeyPair("RS256", { extractable: true }),
      ]);
      keyPairs = { first: firstKeyPair, second: secondKeyPair };
      const [firstPublicJwk, secondPublicJwk] = await Promise.all([
        exportJWK(firstKeyPair.publicKey),
        exportJWK(secondKeyPair.publicKey),
      ]);
      publicJwks = {
        first: { ...firstPublicJwk, alg: "RS256", kid: keyIds.first, use: "sig" },
        second: { ...secondPublicJwk, alg: "RS256", kid: keyIds.second, use: "sig" },
      };

      jwksServer = createServer((request, response) => {
        if (request.method !== "GET" || request.url !== "/auth/keys") {
          response.writeHead(404).end();
          return;
        }

        requestCount += 1;
        response
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ keys: activeJwks }));
      });

      await new Promise<void>((resolve, reject) => {
        jwksServer.once("error", reject);
        jwksServer.listen(0, "127.0.0.1", resolve);
      });

      const address = jwksServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Apple JWKS test server address is unavailable");
      }
      jwksUrl = `http://127.0.0.1:${address.port}/auth/keys`;
    });

    beforeEach(() => {
      activeJwks = [publicJwks.first];
      requestCount = 0;
      apple = new AppleOAuthIdentityAdapter(oauthConfig(jwksUrl));
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => {
        jwksServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    });

    async function signAppleToken(
      key: "first" | "second",
      keyId: string,
      claims: Record<string, unknown> = {},
      options: { issuer?: string; audience?: string; expiresInSeconds?: number } = {},
    ): Promise<string> {
      const now = Math.floor(Date.now() / 1000);
      const userNumber = key === "first" ? 1 : 2;

      return new SignJWT({
        auth_time: now,
        email: `apple-user-${userNumber}@example.com`,
        email_verified: "true",
        nonce_supported: true,
        ...claims,
      })
        .setProtectedHeader({ alg: "RS256", kid: keyId })
        .setIssuer(options.issuer ?? "https://appleid.apple.com")
        .setAudience(options.audience ?? "apple-client-id")
        .setSubject(`apple-user-${userNumber}`)
        .setIssuedAt(now)
        .setExpirationTime(now + (options.expiresInSeconds ?? 3600))
        .sign(keyPairs[key].privateKey);
    }

    it("실제 Apple 서명과 nonce를 검증하고 프로필을 반환한다", async () => {
      // Given
      const nonce = "apple-raw-nonce";
      const idToken = await signAppleToken("first", keyIds.first, {
        nonce: createHash("sha256").update(nonce).digest("hex"),
      });

      // When
      const result = await apple.verifyToken(idToken, nonce);

      // Then
      expect(result).toEqual({
        id: "apple-user-1",
        email: "apple-user-1@example.com",
        emailVerified: true,
      });
      expect(requestCount).toBe(1);
    });

    it("서명은 유효하지만 nonce가 다르면 socialTokenInvalid를 던진다", async () => {
      // Given
      const idToken = await signAppleToken("first", keyIds.first, {
        nonce: createHash("sha256").update("token-raw-nonce").digest("hex"),
      });

      // When
      const verification = apple.verifyToken(idToken, "request-raw-nonce");

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "APPLE" },
      });
      expect(requestCount).toBe(1);
    });

    it("캐시된 kid가 교체되면 JWKS를 다시 조회하고 새 키를 검증한다", async () => {
      // Given
      const firstToken = await signAppleToken("first", keyIds.first);
      await expect(apple.verifyToken(firstToken)).resolves.toMatchObject({ id: "apple-user-1" });
      activeJwks = [publicJwks.second];
      const rotatedToken = await signAppleToken("second", keyIds.second);

      // When
      const result = await apple.verifyToken(rotatedToken);

      // Then
      expect(result).toMatchObject({ id: "apple-user-2" });
      expect(requestCount).toBe(2);
    });

    it.each([
      { condition: "만료된", options: { expiresInSeconds: -60 }, errorCode: ErrorCode.SOCIAL_0203 },
      {
        condition: "issuer가 다른",
        options: { issuer: "https://another-issuer.example" },
        errorCode: ErrorCode.SOCIAL_0202,
      },
      {
        condition: "audience가 다른",
        options: { audience: "another-client-id" },
        errorCode: ErrorCode.SOCIAL_0202,
      },
    ])("$condition Apple JWT는 기존 오류 코드로 거절한다", async ({ options, errorCode }) => {
      // Given
      const idToken = await signAppleToken("first", keyIds.first, {}, options);

      // When
      const verification = apple.verifyToken(idToken);

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode,
        details: { provider: "APPLE" },
      });
    });

    it("kid가 일치해도 다른 개인 키로 서명한 Apple JWT를 거절한다", async () => {
      // Given
      const idToken = await signAppleToken("second", keyIds.first);

      // When
      const verification = apple.verifyToken(idToken);

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "APPLE" },
      });
    });

    it("JWKS에 없는 kid의 토큰은 socialTokenInvalid를 던진다", async () => {
      // Given
      const idToken = await signAppleToken("second", "unknown-apple-kid");

      // When
      const verification = apple.verifyToken(idToken);

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "APPLE" },
      });
      expect(requestCount).toBe(2);
    });
  });
});
