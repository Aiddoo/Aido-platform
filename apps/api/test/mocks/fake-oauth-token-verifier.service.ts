/**
 * 테스트용 FakeOAuthTokenVerifierService
 *
 * 실제 OAuth 제공자와 통신하지 않고, 테스트용 프로필을 반환합니다.
 * E2E 테스트에서 OAuth 로그인 플로우를 테스트할 때 사용합니다.
 */

import { ErrorCode } from "@aido/api/errors";

import type { VerifiedProfile } from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";
import { ApplicationException } from "#api/shared/application/application.exception";

/**
 * 테스트용 OAuth 토큰 검증 서비스
 */
export class FakeOAuthTokenVerifierService {
  verify(provider: AccountProvider, token: string): Promise<VerifiedProfile> {
    switch (provider) {
      case "APPLE":
        return this.verifyAppleToken(token);
      case "GOOGLE":
        return this.verifyGoogleToken(token);
      case "KAKAO":
        return this.verifyKakaoToken(token);
      default:
        return this.verifyNaverToken(token);
    }
  }

  /** 실패 시뮬레이션 설정 */
  #shouldFail = false;
  #failureError: Error | null = null;

  /** 커스텀 프로필 설정 */
  #customProfiles: Map<string, VerifiedProfile> = new Map();

  /**
   * 기본 테스트 프로필 생성
   */
  #createDefaultProfile(provider: string, providerAccountId: string): VerifiedProfile {
    return {
      id: `${provider.toLowerCase()}-${providerAccountId}`,
      email: `test-${provider.toLowerCase()}-${providerAccountId}@example.com`,
      emailVerified: true,
      name: `Test ${provider} User`,
    };
  }

  /**
   * Apple 토큰 검증 (Mock)
   */
  async verifyAppleToken(idToken: string): Promise<VerifiedProfile> {
    this.#checkFailure("APPLE");

    const customProfile = this.#customProfiles.get(`apple:${idToken}`);
    if (customProfile) {
      return customProfile;
    }

    return this.#createDefaultProfile("APPLE", `apple-${idToken.slice(0, 8)}`);
  }

  /**
   * Google 토큰 검증 (Mock)
   */
  async verifyGoogleToken(idToken: string): Promise<VerifiedProfile> {
    this.#checkFailure("GOOGLE");

    const customProfile = this.#customProfiles.get(`google:${idToken}`);
    if (customProfile) {
      return customProfile;
    }

    return this.#createDefaultProfile("GOOGLE", `google-${idToken.slice(0, 8)}`);
  }

  /**
   * Kakao 토큰 검증 (Mock)
   */
  async verifyKakaoToken(accessToken: string): Promise<VerifiedProfile> {
    this.#checkFailure("KAKAO");

    const customProfile = this.#customProfiles.get(`kakao:${accessToken}`);
    if (customProfile) {
      return customProfile;
    }

    return this.#createDefaultProfile("KAKAO", `kakao-${accessToken.slice(0, 8)}`);
  }

  /**
   * Naver 토큰 검증 (Mock)
   */
  async verifyNaverToken(accessToken: string): Promise<VerifiedProfile> {
    this.#checkFailure("NAVER");

    const customProfile = this.#customProfiles.get(`naver:${accessToken}`);
    if (customProfile) {
      return customProfile;
    }

    return this.#createDefaultProfile("NAVER", `naver-${accessToken.slice(0, 8)}`);
  }

  // ===== 테스트 유틸리티 메서드 =====

  /**
   * 실패 시뮬레이션 활성화
   * @param error 던질 에러 (기본값: null - provider별 ApplicationException 사용)
   */
  simulateFailure(error?: Error): void {
    this.#shouldFail = true;
    this.#failureError = error ?? null;
  }

  /**
   * 실패 시뮬레이션 비활성화
   */
  resetFailureSimulation(): void {
    this.#shouldFail = false;
    this.#failureError = null;
  }

  /**
   * 특정 토큰에 대한 커스텀 프로필 설정
   * @param provider OAuth 제공자 (apple, google, kakao, naver)
   * @param token 토큰 값
   * @param profile 반환할 프로필
   */
  setCustomProfile(
    provider: "apple" | "google" | "kakao" | "naver",
    token: string,
    profile: VerifiedProfile,
  ): void {
    this.#customProfiles.set(`${provider}:${token}`, profile);
  }

  /**
   * 모든 커스텀 프로필 초기화
   */
  clearCustomProfiles(): void {
    this.#customProfiles.clear();
  }

  /**
   * 모든 설정 초기화
   */
  clear(): void {
    this.resetFailureSimulation();
    this.clearCustomProfiles();
  }

  // ===== Private 메서드 =====

  /**
   * 실패 시뮬레이션 체크 및 에러 발생
   * @param provider OAuth 제공자 (APPLE, GOOGLE, KAKAO, NAVER)
   */
  #checkFailure(provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER"): void {
    if (this.#shouldFail) {
      // 커스텀 에러가 설정되어 있으면 해당 에러를 던짐
      if (this.#failureError) {
        throw this.#failureError;
      }

      // provider별 적절한 ApplicationException을 던짐 (401 반환)
      switch (provider) {
        case "APPLE":
          throw new ApplicationException(ErrorCode.APPLE_0352);
        case "GOOGLE":
          throw new ApplicationException(ErrorCode.GOOGLE_0402);
        case "KAKAO":
          throw new ApplicationException(ErrorCode.KAKAO_0301, {
            reason: "Token verification failed",
          });
        case "NAVER":
          throw new ApplicationException(ErrorCode.NAVER_0452);
      }
    }
  }
}
