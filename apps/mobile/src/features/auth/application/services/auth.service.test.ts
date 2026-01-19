/**
 * Auth Service Unit Tests
 *
 * AuthService의 비즈니스 로직을 검증합니다.
 * Repository와 TokenStore를 mocking하여 서비스 레이어를 격리 테스트합니다.
 * Given-When-Then 패턴으로 작성되었습니다.
 */

import { TokenStore } from '@src/shared/storage/token-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';
import { AuthRepositoryStub } from '../../data/repositories/auth.repository.stub';
import type { AuthTokens, CurrentUser } from '../../domain/models/user.model';
import { AuthService } from './auth.service';

// ===== Mock 설정 =====

jest.mock('@src/shared/storage/token-store');
jest.mock('expo-web-browser');
jest.mock('expo-linking');

const mockTokenStore = TokenStore as jest.Mocked<typeof TokenStore>;
const mockWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

// ===== Test Suite =====

describe('AuthService', () => {
  let repositoryStub: AuthRepositoryStub;
  let service: AuthService;

  beforeEach(() => {
    // Given: 각 테스트마다 새로운 stub과 service를 생성
    repositoryStub = new AuthRepositoryStub();
    service = new AuthService(repositoryStub);

    // Mock 리셋
    jest.clearAllMocks();
  });

  describe('exchangeCodeAndSaveTokens', () => {
    it('인증 코드를 교환하고 토큰을 저장한다', async () => {
      // Given: 유효한 인증 코드와 예상되는 토큰
      const code = 'valid-auth-code';
      const expectedTokens: AuthTokens = {
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        name: 'Test User',
        profileImage: 'https://example.com/profile.jpg',
      };

      repositoryStub.setFakeTokens(expectedTokens);
      mockTokenStore.setTokens.mockResolvedValue();

      // When: exchangeCodeAndSaveTokens 메서드를 호출
      const result = await service.exchangeCodeAndSaveTokens(code);

      // Then: Repository를 호출하고 TokenStore에 저장
      expect(repositoryStub.exchangeCodeCalled).toBe(true);
      expect(mockTokenStore.setTokens).toHaveBeenCalledWith(
        expectedTokens.accessToken,
        expectedTokens.refreshToken,
      );
      expect(result).toEqual(expectedTokens);
    });

    it('Repository 실패 시 에러를 전파한다', async () => {
      // Given: Repository가 에러를 반환하도록 설정
      const code = 'invalid-code';
      repositoryStub.setShouldFail(true, 'Invalid code');

      // When & Then: 에러가 전파됨
      await expect(service.exchangeCodeAndSaveTokens(code)).rejects.toThrow('Invalid code');
      expect(repositoryStub.exchangeCodeCalled).toBe(true);
      expect(mockTokenStore.setTokens).not.toHaveBeenCalled();
    });

    it('TokenStore 저장 실패 시 에러를 전파한다', async () => {
      // Given: TokenStore가 에러를 반환하도록 설정
      const code = 'valid-code';
      const tokens: AuthTokens = {
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        name: 'Test User',
        profileImage: null,
      };

      repositoryStub.setFakeTokens(tokens);
      mockTokenStore.setTokens.mockRejectedValue(new Error('Storage error'));

      // When & Then: 에러가 전파됨
      await expect(service.exchangeCodeAndSaveTokens(code)).rejects.toThrow('Storage error');
      expect(repositoryStub.exchangeCodeCalled).toBe(true);
      expect(mockTokenStore.setTokens).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('현재 사용자 정보를 조회한다', async () => {
      // Given: 예상되는 사용자 정보
      const expectedUser: CurrentUser = {
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        email: 'test@example.com',
        sessionId: 'clz7x5p8k0002qz0z8z8z8z8z',
        userTag: 'TEST2024',
        status: 'ACTIVE',
        emailVerifiedAt: new Date('2024-01-15T10:30:00.000Z'),
        subscriptionStatus: 'FREE',
        subscriptionExpiresAt: null,
        name: 'Test User',
        profileImage: 'https://example.com/profile.jpg',
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
      };

      repositoryStub.setFakeUser(expectedUser);

      // When: getCurrentUser 메서드를 호출
      const result = await service.getCurrentUser();

      // Then: Repository를 호출하고 사용자 정보를 반환
      expect(repositoryStub.getCurrentUserCalled).toBe(true);
      expect(result).toEqual(expectedUser);
    });

    it('Repository 실패 시 에러를 전파한다', async () => {
      // Given: Repository가 에러를 반환하도록 설정
      repositoryStub.setShouldFail(true, 'Unauthorized');

      // When & Then: 에러가 전파됨
      await expect(service.getCurrentUser()).rejects.toThrow('Unauthorized');
      expect(repositoryStub.getCurrentUserCalled).toBe(true);
    });
  });

  describe('logout', () => {
    it('로그아웃을 성공적으로 처리한다', async () => {
      // Given: 정상적인 로그아웃 상황
      mockTokenStore.clearTokens.mockResolvedValue();

      // When: logout 메서드를 호출
      await service.logout();

      // Then: Repository를 호출하고 TokenStore를 정리
      expect(repositoryStub.logoutCalled).toBe(true);
      expect(mockTokenStore.clearTokens).toHaveBeenCalled();
    });

    it('Repository 실패 시에도 토큰을 삭제한다', async () => {
      // Given: Repository가 에러를 반환하도록 설정
      repositoryStub.setShouldFail(true, 'Server error');
      mockTokenStore.clearTokens.mockResolvedValue();

      // When: logout 메서드를 호출 (에러가 발생하지 않음)
      await service.logout();

      // Then: Repository 호출은 실패했지만 TokenStore는 정리됨
      expect(repositoryStub.logoutCalled).toBe(true);
      expect(mockTokenStore.clearTokens).toHaveBeenCalled();
    });

    it('TokenStore 정리 실패 시 에러를 전파한다', async () => {
      // Given: TokenStore가 에러를 반환하도록 설정
      mockTokenStore.clearTokens.mockRejectedValue(new Error('Storage error'));

      // When & Then: 에러가 전파됨
      await expect(service.logout()).rejects.toThrow('Storage error');
      expect(repositoryStub.logoutCalled).toBe(true);
      expect(mockTokenStore.clearTokens).toHaveBeenCalled();
    });
  });

  describe('openKakaoLogin', () => {
    it('성공 시 인증 코드를 반환한다', async () => {
      // Given: WebBrowser가 성공 응답을 반환하도록 설정
      const redirectUri = 'myapp://auth/kakao';
      const authCode = 'kakao-auth-code-xyz';
      const resultUrl = `${redirectUri}?code=${authCode}`;

      mockLinking.createURL.mockReturnValue(redirectUri);
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: resultUrl,
      });
      mockLinking.parse.mockReturnValue({
        hostname: null,
        path: 'auth/kakao',
        queryParams: { code: authCode },
        scheme: 'myapp',
      });

      // When: openKakaoLogin 메서드를 호출
      const result = await service.openKakaoLogin();

      // Then: 올바른 URL로 WebBrowser를 열고 인증 코드를 반환
      expect(mockLinking.createURL).toHaveBeenCalledWith('auth/kakao');
      expect(repositoryStub.getKakaoAuthUrlCalled).toBe(true);
      expect(mockWebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        expect.stringContaining('/v1/auth/kakao/start'),
        redirectUri,
      );
      expect(result).toBe(authCode);
    });

    it('취소 시 null을 반환한다', async () => {
      // Given: WebBrowser가 취소 응답을 반환하도록 설정
      const redirectUri = 'myapp://auth/kakao';

      mockLinking.createURL.mockReturnValue(redirectUri);
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: WebBrowserResultType.CANCEL,
      });

      // When: openKakaoLogin 메서드를 호출
      const result = await service.openKakaoLogin();

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('URL에 code가 없을 경우 null을 반환한다', async () => {
      // Given: WebBrowser가 code 없는 URL을 반환하도록 설정
      const redirectUri = 'myapp://auth/kakao';
      const resultUrl = `${redirectUri}?error=access_denied`;

      mockLinking.createURL.mockReturnValue(redirectUri);
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: resultUrl,
      });
      mockLinking.parse.mockReturnValue({
        hostname: null,
        path: 'auth/kakao',
        queryParams: { error: 'access_denied' },
        scheme: 'myapp',
      });

      // When: openKakaoLogin 메서드를 호출
      const result = await service.openKakaoLogin();

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('WebBrowser가 dismiss된 경우 null을 반환한다', async () => {
      // Given: WebBrowser가 dismiss 응답을 반환하도록 설정
      const redirectUri = 'myapp://auth/kakao';

      mockLinking.createURL.mockReturnValue(redirectUri);
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: WebBrowserResultType.DISMISS,
      });

      // When: openKakaoLogin 메서드를 호출
      const result = await service.openKakaoLogin();

      // Then: null 반환
      expect(result).toBeNull();
    });
  });
});
