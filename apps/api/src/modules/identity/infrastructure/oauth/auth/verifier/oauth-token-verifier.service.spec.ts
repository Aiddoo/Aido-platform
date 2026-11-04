import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

import { ErrorCode } from "@aido/api/errors";
import { Logger } from "@nestjs/common";
import { HttpClient, getHttpClientToken } from "@nestjs/http-client";
import { TestBed } from "@suites/unit";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { vi, type Mock } from "vitest";

import {
  OAUTH_PROVIDER_TIMEOUT_MS,
  OAuthTokenVerifierService,
} from "#api/modules/identity/infrastructure/oauth/auth/verifier/oauth-token-verifier.service";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { asMock } from "#test/mocks/index";

// Google Auth Library 모킹
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

async function responseFromFixture(fixture: {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}): Promise<Response> {
  return new Response(fixture.json ? JSON.stringify(await fixture.json()) : null, {
    status: fixture.status ?? (fixture.ok ? 200 : 500),
  });
}

describe("OAuthTokenVerifierService — OAuth 토큰 검증 서비스", () => {
  let service: OAuthTokenVerifierService;
  let mockGoogleVerifyIdToken: Mock;
  let appleJwksUrl: string | undefined;

  beforeEach(async () => {
    // Google Auth Library mock 설정
    const { OAuth2Client } = await vi.importMock<{ OAuth2Client: Mock }>("google-auth-library");
    mockGoogleVerifyIdToken = vi.fn();
    OAuth2Client.mockImplementation(function () {
      return { verifyIdToken: mockGoogleVerifyIdToken };
    });

    const { unit } = await TestBed.solitary(OAuthTokenVerifierService)
      .mock(getHttpClientToken("oauth"))
      .final(new HttpClient({ retry: false, throwOnHttpError: false }))
      .mock(TypedConfigService)
      .final({
        googleOAuth: { clientId: "google-client-id" },
        get appleOAuth() {
          return {
            clientId: "apple-client-id",
            jwksUrl: appleJwksUrl,
            jwksCooldownDurationMs: appleJwksUrl == null ? undefined : 0,
          };
        },
      })
      .compile();

    service = unit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Google 공개키 조회에도 OAuth 공급자 시간 제한(10초)을 건다", async () => {
    // Given
    const { OAuth2Client } = await vi.importMock<{ OAuth2Client: Mock }>("google-auth-library");

    // Then
    expect(OAUTH_PROVIDER_TIMEOUT_MS).toBe(10_000);
    expect(OAuth2Client).toHaveBeenCalledWith(
      expect.objectContaining({ transporterOptions: { timeout: OAUTH_PROVIDER_TIMEOUT_MS } }),
    );
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
      mockGoogleVerifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });

      // When
      const result = await service.verifyGoogleToken("valid-google-token");

      // Then
      expect(result).toEqual({
        id: "google-user-123",
        email: "test@gmail.com",
        emailVerified: true,
        name: "홍길동",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
      });
      expect(mockGoogleVerifyIdToken).toHaveBeenCalledWith({
        idToken: "valid-google-token",
        audience: "google-client-id",
      });
    });

    it("이메일이 없는 Google 프로필도 처리한다", async () => {
      // Given
      mockGoogleVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: "google-user-456",
          email_verified: false,
        }),
      });

      // When
      const result = await service.verifyGoogleToken("valid-token");

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
      mockGoogleVerifyIdToken.mockResolvedValue({
        getPayload: () => null,
      });

      // When & Then
      await expect(service.verifyGoogleToken("invalid-token")).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "GOOGLE" },
      });
    });

    it("만료된 토큰은 socialTokenExpired 에러를 발생시킨다", async () => {
      // Given
      const loggerErrorSpy = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const sensitiveSubject = "google-user-123";
      mockGoogleVerifyIdToken.mockRejectedValue(
        new Error(`Token used too late, 100 > 90: {"sub":"${sensitiveSubject}"}`),
      );

      // When
      const verification = service.verifyGoogleToken("expired-token");

      // Then
      await expect(verification).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0203,
        details: { provider: "GOOGLE" },
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        event: "identity.oauth.token-verify.failed",
        provider: "GOOGLE",
        reason: "expired",
        errorType: "Error",
      });
      expect(JSON.stringify(loggerErrorSpy.mock.calls)).not.toContain(sensitiveSubject);
    });

    it("audience가 다른 토큰은 socialTokenInvalid 에러를 발생시킨다", async () => {
      // Given
      mockGoogleVerifyIdToken.mockRejectedValue(
        new Error("Wrong recipient, payload audience != requiredAudience"),
      );

      // When & Then
      await expect(service.verifyGoogleToken("wrong-audience-token")).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "GOOGLE" },
      });
    });

    it("잘못된 토큰은 socialTokenInvalid 에러를 발생시킨다", async () => {
      // Given
      mockGoogleVerifyIdToken.mockRejectedValue(new Error("Invalid signature"));

      // When & Then
      await expect(service.verifyGoogleToken("malformed-token")).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "GOOGLE" },
      });
    });
  });

  describe("Kakao Access Token 검증", () => {
    const mockKakaoResponse = {
      id: 12345678,
      kakao_account: {
        email: "test@kakao.com",
        is_email_verified: true,
        profile: {
          nickname: "카카오유저",
          profile_image_url: "https://k.kakaocdn.net/dn/profile.jpg",
        },
      },
    };

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("유효한 Kakao access token을 검증하면 프로필을 반환한다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () => Promise.resolve(mockKakaoResponse),
        }),
      );

      // When
      const result = await service.verifyKakaoToken("valid-kakao-token");

      // Then
      expect(result).toEqual({
        id: "12345678",
        email: "test@kakao.com",
        emailVerified: true,
        name: "카카오유저",
        picture: "https://k.kakaocdn.net/dn/profile.jpg",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        new URL("https://kapi.kakao.com/v2/user/me?secure_resource=true"),
        expect.objectContaining({
          headers: new Headers({
            Authorization: "Bearer valid-kakao-token",
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          }),
        }),
      );
    });

    it("이메일이 없는 Kakao 계정도 처리한다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 87654321,
              kakao_account: {
                profile: {
                  nickname: "닉네임만",
                },
              },
            }),
        }),
      );

      // When
      const result = await service.verifyKakaoToken("valid-token");

      // Then
      expect(result.email).toBeNull();
      expect(result.emailVerified).toBe(false);
    });

    it("401 응답은 socialTokenExpired 에러를 발생시킨다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: false,
          status: 401,
        }),
      );

      // When & Then
      await expect(service.verifyKakaoToken("expired-token")).rejects.toThrow(ApplicationException);
    });

    it("검증 성공·실패 로그에 공급자 사용자 ID와 오류 원문을 남기지 않는다", async () => {
      // Given
      const logged = [
        vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined),
        vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined),
      ];
      asMock(global.fetch)
        .mockResolvedValueOnce(
          await responseFromFixture({ ok: true, json: () => Promise.resolve(mockKakaoResponse) }),
        )
        .mockResolvedValueOnce(await responseFromFixture({ ok: false, status: 401 }));

      // When
      await service.verifyKakaoToken("valid-kakao-token");
      await service.verifyKakaoToken("expired-token").catch(() => undefined);

      // Then
      expect(logged[1]).toHaveBeenCalledWith({
        event: "identity.oauth.token-verify.failed",
        provider: "KAKAO",
        errorType: "ApplicationException",
        errorCode: ErrorCode.SOCIAL_0203,
      });
      const calls = JSON.stringify(logged.map((spy) => spy.mock.calls));
      expect(calls).not.toContain(String(mockKakaoResponse.id));
      expect(calls).not.toContain("test@kakao.com");
    });

    it("기타 에러 응답은 socialTokenInvalid 에러를 발생시킨다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: false,
          status: 400,
        }),
      );

      // When & Then
      await expect(service.verifyKakaoToken("invalid-token")).rejects.toThrow(ApplicationException);
    });
  });

  describe("Naver Access Token 검증", () => {
    const mockNaverResponse = {
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

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("유효한 Naver access token을 검증하면 프로필을 반환한다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () => Promise.resolve(mockNaverResponse),
        }),
      );

      // When
      const result = await service.verifyNaverToken("valid-naver-token");

      // Then
      expect(result).toEqual({
        id: "naver-user-123",
        email: "test@naver.com",
        emailVerified: false, // Naver는 이메일 인증 여부를 제공하지 않으므로 항상 false
        name: "네이버유저",
        picture: "https://phinf.pstatic.net/profile.jpg",
      });
      expect(global.fetch).toHaveBeenCalledWith(
        new URL("https://openapi.naver.com/v1/nid/me"),
        expect.objectContaining({
          headers: new Headers({ Authorization: "Bearer valid-naver-token" }),
        }),
      );
    });

    it("이름이 없으면 닉네임을 사용한다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () =>
            Promise.resolve({
              resultcode: "00",
              message: "success",
              response: {
                id: "naver-user-456",
                nickname: "닉네임만",
              },
            }),
        }),
      );

      // When
      const result = await service.verifyNaverToken("valid-token");

      // Then
      expect(result.name).toBe("닉네임만");
    });

    it("이메일이 없으면 emailVerified는 false이다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () =>
            Promise.resolve({
              resultcode: "00",
              message: "success",
              response: {
                id: "naver-user-789",
                name: "이름만",
              },
            }),
        }),
      );

      // When
      const result = await service.verifyNaverToken("valid-token");

      // Then
      expect(result.email).toBeNull();
      expect(result.emailVerified).toBe(false);
    });

    it("401 응답은 socialTokenExpired 에러를 발생시킨다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: false,
          status: 401,
        }),
      );

      // When & Then
      await expect(service.verifyNaverToken("expired-token")).rejects.toThrow(ApplicationException);
    });

    it("resultcode가 00이 아니면 에러를 발생시킨다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () =>
            Promise.resolve({
              resultcode: "01",
              message: "error",
            }),
        }),
      );

      // When & Then
      await expect(service.verifyNaverToken("invalid-token")).rejects.toThrow(ApplicationException);
    });

    it("response가 없으면 에러를 발생시킨다", async () => {
      // Given
      asMock(global.fetch).mockResolvedValue(
        await responseFromFixture({
          ok: true,
          json: () =>
            Promise.resolve({
              resultcode: "00",
              message: "success",
            }),
        }),
      );

      // When & Then
      await expect(service.verifyNaverToken("invalid-token")).rejects.toThrow(ApplicationException);
    });
  });

  describe("Apple ID Token 검증", () => {
    const nativeFetch = global.fetch;
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
    let requestCount: number;

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
        first: {
          ...firstPublicJwk,
          alg: "RS256",
          kid: keyIds.first,
          use: "sig",
        },
        second: {
          ...secondPublicJwk,
          alg: "RS256",
          kid: keyIds.second,
          use: "sig",
        },
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
      appleJwksUrl = `http://127.0.0.1:${address.port}/auth/keys`;
    });

    beforeEach(() => {
      global.fetch = nativeFetch;
      activeJwks = [publicJwks.first];
      requestCount = 0;
    });

    afterAll(async () => {
      global.fetch = nativeFetch;
      appleJwksUrl = undefined;
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
        .setExpirationTime(now + (options.expiresInSeconds ?? 3_600))
        .sign(keyPairs[key].privateKey);
    }

    it("실제 Apple 서명과 nonce를 검증하고 프로필을 반환한다", async () => {
      // Given
      const nonce = "apple-raw-nonce";
      const idToken = await signAppleToken("first", keyIds.first, {
        nonce: createHash("sha256").update(nonce).digest("hex"),
      });

      // When
      const result = await service.verifyAppleToken(idToken, nonce);

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

      // When & Then
      await expect(service.verifyAppleToken(idToken, "request-raw-nonce")).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "APPLE" },
      });
      expect(requestCount).toBe(1);
    });

    it("캐시된 kid가 교체되면 JWKS를 다시 조회하고 새 키를 검증한다", async () => {
      // Given
      const firstToken = await signAppleToken("first", keyIds.first);
      await expect(service.verifyAppleToken(firstToken)).resolves.toMatchObject({
        id: "apple-user-1",
      });
      activeJwks = [publicJwks.second];
      const rotatedToken = await signAppleToken("second", keyIds.second);

      // When
      const result = await service.verifyAppleToken(rotatedToken);

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
      // When / Then
      await expect(service.verifyAppleToken(idToken)).rejects.toMatchObject({
        errorCode,
        details: { provider: "APPLE" },
      });
    });

    it("kid가 일치해도 다른 개인 키로 서명한 Apple JWT를 거절한다", async () => {
      // Given
      const idToken = await signAppleToken("second", keyIds.first);
      // When / Then
      await expect(service.verifyAppleToken(idToken)).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "APPLE" },
      });
    });

    it("JWKS에 없는 kid의 토큰은 socialTokenInvalid를 던진다", async () => {
      // Given
      const idToken = await signAppleToken("second", "unknown-apple-kid");

      // When & Then
      await expect(service.verifyAppleToken(idToken)).rejects.toMatchObject({
        errorCode: ErrorCode.SOCIAL_0202,
        details: { provider: "APPLE" },
      });
      expect(requestCount).toBe(2);
    });
  });
});
