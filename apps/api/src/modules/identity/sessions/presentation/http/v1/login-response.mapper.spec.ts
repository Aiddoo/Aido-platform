import type { OAuthExchangeReadModel } from "#api/modules/identity/oauth-states/application/read-models/oauth-exchange.read-model";
import type {
  LoginReadModel,
  RefreshedTokensReadModel,
  SocialLoginReadModel,
  EmailVerificationReadModel,
} from "#api/modules/identity/sessions/application/read-models/login.read-model";
import type { CurrentUserReadModel } from "#api/modules/identity/users/application/read-models/current-user.read-model";
import type {
  RegistrationReadModel,
  UpdatedProfileReadModel,
} from "#api/modules/identity/users/application/read-models/user-account.read-model";
import { createFeatureEntitlementsFixture } from "#test/fixtures/access/access-user.fixture";

import { toExchangeCodeResponse } from "../../../../oauth-states/presentation/http/v1/oauth-response.mapper.js";
import {
  toCurrentUserResponse,
  toRegisterResponse,
  toUpdateProfileResponse,
} from "../../../../users/presentation/http/v1/user-account-response.mapper.js";
import {
  toAuthTokensResponse,
  toMessageResponse,
  toRefreshTokensResponse,
  toSocialAuthTokensResponse,
} from "./login-response.mapper.js";

describe("인증 응답 매퍼", () => {
  describe("toRegisterResponse", () => {
    it("회원가입 결과를 응답 형식으로 변환한다", () => {
      // Given
      const result: RegistrationReadModel = {
        userId: "user-123",
        email: "test@example.com",
        emailSent: true,
        message: "회원가입이 완료되었습니다.",
      };

      // When
      const response = toRegisterResponse(result);

      // Then
      expect(response).toEqual({
        message: "회원가입이 완료되었습니다.",
        email: "test@example.com",
        emailSent: true,
      });
    });
  });

  describe("toAuthTokensResponse", () => {
    it("이메일 인증 결과를 토큰 응답으로 변환한다", () => {
      // Given
      const result: EmailVerificationReadModel = {
        userId: "user-123",
        userTag: "user#1234",
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: 3600,
        },
        name: "테스터",
        profileImage: "https://example.com/img.jpg",
      };

      // When
      const response = toAuthTokensResponse(result);

      // Then
      expect(response).toEqual({
        userId: "user-123",
        userTag: "user#1234",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        name: "테스터",
        profileImage: "https://example.com/img.jpg",
        accountRestored: false,
      });
    });

    it("로그인 결과를 토큰 응답으로 변환한다", () => {
      // Given
      const result: LoginReadModel = {
        userId: "user-456",
        userTag: "login#5678",
        tokens: {
          accessToken: "login-access",
          refreshToken: "login-refresh",
          expiresIn: 3600,
        },
        sessionId: "session-789",
        name: null,
        profileImage: null,
      };

      // When
      const response = toAuthTokensResponse(result);

      // Then
      expect(response).toEqual({
        userId: "user-456",
        userTag: "login#5678",
        accessToken: "login-access",
        refreshToken: "login-refresh",
        name: null,
        profileImage: null,
        accountRestored: false,
      });
    });

    it("계정 복구 로그인 시 accountRestored: true를 포함한다", () => {
      // Given
      const result: LoginReadModel = {
        userId: "user-789",
        userTag: "rest#1234",
        tokens: {
          accessToken: "restored-access",
          refreshToken: "restored-refresh",
          expiresIn: 3600,
        },
        sessionId: "session-restored",
        name: "복구유저",
        profileImage: null,
        accountRestored: true,
      };

      // When
      const response = toAuthTokensResponse(result);

      // Then
      expect(response.accountRestored).toBe(true);
    });
  });

  describe("toSocialAuthTokensResponse", () => {
    it("소셜 로그인 결과의 신규 가입 여부를 응답에 싣는다", () => {
      // Given
      const result: SocialLoginReadModel = {
        userId: "user-social",
        userTag: "soci#1234",
        tokens: {
          accessToken: "social-access",
          refreshToken: "social-refresh",
          expiresIn: 3600,
        },
        sessionId: "session-social",
        name: "소셜유저",
        profileImage: null,
        isNewUser: true,
      };

      // When
      const response = toSocialAuthTokensResponse(result);

      // Then
      expect(response).toEqual({
        userId: "user-social",
        userTag: "soci#1234",
        accessToken: "social-access",
        refreshToken: "social-refresh",
        name: "소셜유저",
        profileImage: null,
        accountRestored: false,
        isNewUser: true,
      });
    });
  });

  describe("toRefreshTokensResponse", () => {
    it("토큰 갱신 결과를 응답으로 변환한다", () => {
      // Given
      const result: RefreshedTokensReadModel = {
        tokens: {
          accessToken: "new-access",
          refreshToken: "new-refresh",
          expiresIn: 3600,
        },
        sessionId: "session-123",
      };

      // When
      const response = toRefreshTokensResponse(result);

      // Then
      expect(response).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
    });
  });

  describe("toCurrentUserResponse", () => {
    it("현재 사용자 정보의 모든 필드를 포함한 응답으로 변환한다", () => {
      // Given
      const features = createFeatureEntitlementsFixture("PREMIUM");
      const usage = { used: 1, resetsAt: "2024-02-01T00:00:00.000Z" };
      const result: CurrentUserReadModel = {
        userId: "user-123",
        email: "test@example.com",
        sessionId: "session-456",
        role: "USER",
        userTag: "test#1234",
        status: "ACTIVE",
        emailVerifiedAt: "2024-01-01T00:00:00.000Z",
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
        name: "테스터",
        profileImage: "https://example.com/img.jpg",
        createdAt: "2024-01-01T00:00:00.000Z",
        providers: ["CREDENTIAL", "KAKAO"],
        premiumSource: "GRANT",
        premiumEndsAt: "2024-01-15T00:00:00.000Z",
        premiumPeriodEndsAt: "2024-01-08T00:00:00.000Z",
        willRenew: false,
        bankedPremiumDays: 7,
        premiumGrantEndedAt: null,
        premiumIsTrial: false,
        premiumPlanType: null,
        isPremium: true,
        entitlements: {
          ...features,
          AI_PARSE: { ...features.AI_PARSE, ...usage },
          CHEER: { ...features.CHEER, ...usage },
          NUDGE: { ...features.NUDGE, ...usage },
        },
      };

      // When
      const response = toCurrentUserResponse(result);

      // Then
      expect(response).toEqual(result);
      expect(Object.keys(response)).toHaveLength(23);
    });
  });

  describe("toUpdateProfileResponse", () => {
    it("프로필 수정 결과를 응답으로 변환한다", () => {
      // Given
      const result: UpdatedProfileReadModel = {
        message: "프로필이 수정되었습니다.",
        name: "새이름",
        profileImage: "https://example.com/new.jpg",
      };

      // When
      const response = toUpdateProfileResponse(result);

      // Then
      expect(response).toEqual({
        message: "프로필이 수정되었습니다.",
        name: "새이름",
        profileImage: "https://example.com/new.jpg",
      });
    });
  });

  describe("toMessageResponse", () => {
    it("단순 메시지 응답을 생성한다", () => {
      // Given
      const message = "로그아웃되었습니다.";

      // When
      const response = toMessageResponse(message);

      // Then
      expect(response).toEqual({ message: "로그아웃되었습니다." });
    });
  });

  describe("toExchangeCodeResponse", () => {
    it("OAuth 코드 교환 결과를 응답으로 변환한다", () => {
      // Given
      const result: OAuthExchangeReadModel = {
        userId: "user-789",
        accessToken: "oauth-access",
        refreshToken: "oauth-refresh",
        userName: "OAuth유저",
        profileImage: "https://example.com/oauth.jpg",
        isNewUser: true,
      };

      // When
      const response = toExchangeCodeResponse(result);

      // Then
      expect(response).toEqual({
        userId: "user-789",
        accessToken: "oauth-access",
        refreshToken: "oauth-refresh",
        name: "OAuth유저",
        profileImage: "https://example.com/oauth.jpg",
        accountRestored: false,
        isNewUser: true,
      });
    });

    it("userName이 undefined면 null로 변환한다", () => {
      // Given
      const result: OAuthExchangeReadModel = {
        userId: "user-789",
        accessToken: "oauth-access",
        refreshToken: "oauth-refresh",
        isNewUser: false,
      };

      // When
      const response = toExchangeCodeResponse(result);

      // Then
      expect(response.name).toBeNull();
      expect(response.profileImage).toBeNull();
      expect(response.accountRestored).toBe(false);
    });

    it("계정 복구 시 accountRestored: true를 포함한다", () => {
      // Given
      const result: OAuthExchangeReadModel = {
        userId: "user-restored",
        accessToken: "restored-access",
        refreshToken: "restored-refresh",
        userName: "복구유저",
        accountRestored: true,
        isNewUser: false,
      };

      // When
      const response = toExchangeCodeResponse(result);

      // Then
      expect(response.accountRestored).toBe(true);
    });
  });
});
