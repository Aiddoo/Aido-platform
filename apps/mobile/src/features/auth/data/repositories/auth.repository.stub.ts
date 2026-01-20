/**
 * Auth Repository Stub (Test Double)
 *
 * 테스트를 위한 가짜 Repository 구현체입니다.
 * 네트워크 호출 없이 가상 환경에서 테스트할 수 있습니다.
 */

import type { AuthTokens, CurrentUser, ExchangeCodeInput } from '../../domain/models/user.model';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

// ===== 기본 Fake 데이터 =====
const DEFAULT_FAKE_TOKENS: AuthTokens = {
  userId: 'stub-user-id',
  accessToken: 'stub-access-token',
  refreshToken: 'stub-refresh-token',
  name: 'Stub User',
  profileImage: null,
};

const DEFAULT_FAKE_USER: CurrentUser = {
  userId: 'stub-user-id',
  email: 'stub@example.com',
  sessionId: 'stub-session-id',
  userTag: 'STUB0001',
  status: 'ACTIVE',
  emailVerifiedAt: new Date('2024-01-15T10:30:00.000Z'),
  subscriptionStatus: 'FREE',
  subscriptionExpiresAt: null,
  name: 'Stub User',
  profileImage: null,
  createdAt: new Date('2024-01-15T00:00:00.000Z'),
};

/**
 * 테스트용 AuthRepository Stub
 */
export class AuthRepositoryStub implements AuthRepository {
  // ===== 호출 추적 플래그 =====
  public exchangeCodeCalled = false;
  public getCurrentUserCalled = false;
  public logoutCalled = false;
  public getKakaoAuthUrlCalled = false;

  // ===== 호출 횟수 추적 =====
  public exchangeCodeCallCount = 0;
  public getCurrentUserCallCount = 0;
  public logoutCallCount = 0;
  public getKakaoAuthUrlCallCount = 0;

  // ===== 파라미터 추적 =====
  public lastExchangeCodeParams: ExchangeCodeInput | null = null;
  public lastGetKakaoAuthUrlParams: string | null = null;

  // ===== Fake 데이터 =====
  private fakeTokens: AuthTokens | null = null;
  private fakeUser: CurrentUser | null = null;

  // ===== 에러 시뮬레이션 =====
  private shouldFail = false;
  private errorMessage = 'Repository stub error';

  // ===== Fake 데이터 설정 메서드 =====

  setFakeTokens(tokens: AuthTokens): void {
    this.fakeTokens = tokens;
  }

  setFakeUser(user: CurrentUser): void {
    this.fakeUser = user;
  }

  setShouldFail(shouldFail: boolean, errorMessage?: string): void {
    this.shouldFail = shouldFail;
    if (errorMessage) {
      this.errorMessage = errorMessage;
    }
  }

  /**
   * 모든 플래그와 데이터를 초기 상태로 리셋합니다.
   */
  reset(): void {
    // 호출 플래그 리셋
    this.exchangeCodeCalled = false;
    this.getCurrentUserCalled = false;
    this.logoutCalled = false;
    this.getKakaoAuthUrlCalled = false;

    // 호출 횟수 리셋
    this.exchangeCodeCallCount = 0;
    this.getCurrentUserCallCount = 0;
    this.logoutCallCount = 0;
    this.getKakaoAuthUrlCallCount = 0;

    // 파라미터 추적 리셋
    this.lastExchangeCodeParams = null;
    this.lastGetKakaoAuthUrlParams = null;

    // Fake 데이터 리셋
    this.fakeTokens = null;
    this.fakeUser = null;

    // 에러 설정 리셋
    this.shouldFail = false;
    this.errorMessage = 'Repository stub error';
  }

  // ===== Repository 메서드 구현 =====

  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    this.exchangeCodeCalled = true;
    this.exchangeCodeCallCount++;
    this.lastExchangeCodeParams = request;

    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }

    return this.fakeTokens ?? DEFAULT_FAKE_TOKENS;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    this.getCurrentUserCalled = true;
    this.getCurrentUserCallCount++;

    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }

    return this.fakeUser ?? DEFAULT_FAKE_USER;
  }

  async logout(): Promise<void> {
    this.logoutCalled = true;
    this.logoutCallCount++;

    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }

    // 로그아웃은 void 반환
  }

  getKakaoAuthUrl(redirectUri: string): string {
    this.getKakaoAuthUrlCalled = true;
    this.getKakaoAuthUrlCallCount++;
    this.lastGetKakaoAuthUrlParams = redirectUri;

    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }

    return `https://stub-api.example.com/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
