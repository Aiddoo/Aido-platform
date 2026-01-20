/**
 * Auth Repository Implementation Unit Tests
 *
 * HttpClient를 mocking하여 AuthRepositoryImpl의 동작을 검증합니다.
 * Given-When-Then 패턴으로 작성되었습니다.
 */

import type { HttpClient, HttpClientResponse } from '@src/shared/api/http-client';
import type { ApiResponse } from '@src/shared/api/types';
import type { AuthTokens, CurrentUser } from '../../domain/models/user.model';
import { AuthRepositoryImpl } from './auth.repository.impl';

// ===== Mock HttpClient =====

const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

// ===== Test Suite =====

describe('AuthRepositoryImpl', () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let repository: AuthRepositoryImpl;

  beforeEach(() => {
    // Given: 각 테스트마다 새로운 mock과 repository를 생성
    mockHttpClient = createMockHttpClient();
    repository = new AuthRepositoryImpl(mockHttpClient);
  });

  describe('exchangeCode', () => {
    it('인증 코드를 교환하여 토큰을 반환한다', async () => {
      // Given: 유효한 인증 코드와 예상되는 토큰 응답
      const request = { code: 'valid-auth-code' };
      const expectedTokens: AuthTokens = {
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        name: 'Test User',
        profileImage: 'https://example.com/profile.jpg',
      };

      const apiResponse: HttpClientResponse<ApiResponse<AuthTokens>> = {
        data: {
          success: true,
          data: expectedTokens,
        },
        status: 200,
      };

      mockHttpClient.post.mockResolvedValue(apiResponse);

      // When: exchangeCode 메서드를 호출
      const result = await repository.exchangeCode(request);

      // Then: 올바른 엔드포인트로 요청하고 토큰을 반환
      expect(mockHttpClient.post).toHaveBeenCalledWith('v1/auth/exchange', request);
      expect(result).toEqual(expectedTokens);
    });

    it('유효하지 않은 응답 형식일 경우 에러를 발생시킨다', async () => {
      // Given: 잘못된 형식의 응답 데이터
      const request = { code: 'valid-auth-code' };
      const invalidResponse: HttpClientResponse<ApiResponse<unknown>> = {
        data: {
          success: true,
          data: {
            // userId 필드 누락 (유효하지 않은 AuthTokens)
            accessToken: 'access-token-abc',
            refreshToken: 'refresh-token-xyz',
          },
        },
        status: 200,
      };

      mockHttpClient.post.mockResolvedValue(invalidResponse);

      // When & Then: 스키마 검증 실패로 에러 발생
      await expect(repository.exchangeCode(request)).rejects.toThrow('Invalid API response format');
    });

    it('네트워크 에러가 발생하면 에러를 전파한다', async () => {
      // Given: 네트워크 에러 상황
      const request = { code: 'valid-auth-code' };
      const networkError = new Error('Network error');

      mockHttpClient.post.mockRejectedValue(networkError);

      // When & Then: 에러가 그대로 전파됨
      await expect(repository.exchangeCode(request)).rejects.toThrow('Network error');
    });
  });

  describe('getCurrentUser', () => {
    it('현재 사용자 정보를 조회한다', async () => {
      // Given: API 응답 데이터 (string 형식)
      const apiUserData = {
        userId: 'clz7x5p8k0001qz0z8z8z8z8z',
        email: 'test@example.com',
        sessionId: 'clz7x5p8k0002qz0z8z8z8z8z',
        userTag: 'TEST2024',
        status: 'ACTIVE',
        emailVerifiedAt: '2024-01-15T10:30:00.000Z',
        subscriptionStatus: 'FREE',
        subscriptionExpiresAt: null,
        name: 'Test User',
        profileImage: 'https://example.com/profile.jpg',
        createdAt: '2024-01-15T00:00:00.000Z',
      };

      // Given: 스키마 변환 후 기대값 (Date 형식)
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

      const apiResponse: HttpClientResponse<ApiResponse<unknown>> = {
        data: {
          success: true,
          data: apiUserData,
        },
        status: 200,
      };

      mockHttpClient.get.mockResolvedValue(apiResponse);

      // When: getCurrentUser 메서드를 호출
      const result = await repository.getCurrentUser();

      // Then: 올바른 엔드포인트로 요청하고 사용자 정보를 반환
      expect(mockHttpClient.get).toHaveBeenCalledWith('v1/auth/me');
      expect(result).toEqual(expectedUser);
    });

    it('유효하지 않은 응답 형식일 경우 에러를 발생시킨다', async () => {
      // Given: 잘못된 형식의 응답 데이터
      const invalidResponse: HttpClientResponse<ApiResponse<unknown>> = {
        data: {
          success: true,
          data: {
            // userId 필드 누락 (유효하지 않은 CurrentUser)
            name: 'Test User',
            email: 'test@example.com',
          },
        },
        status: 200,
      };

      mockHttpClient.get.mockResolvedValue(invalidResponse);

      // When & Then: 스키마 검증 실패로 에러 발생
      await expect(repository.getCurrentUser()).rejects.toThrow('Invalid API response format');
    });

    it('인증되지 않은 경우 에러를 전파한다', async () => {
      // Given: 401 Unauthorized 에러
      const authError = new Error('Unauthorized');

      mockHttpClient.get.mockRejectedValue(authError);

      // When & Then: 에러가 그대로 전파됨
      await expect(repository.getCurrentUser()).rejects.toThrow('Unauthorized');
    });
  });

  describe('logout', () => {
    it('로그아웃 요청을 성공적으로 처리한다', async () => {
      // Given: 성공적인 로그아웃 응답
      const apiResponse: HttpClientResponse<ApiResponse<void>> = {
        data: {
          success: true,
          data: undefined,
        },
        status: 200,
      };

      mockHttpClient.post.mockResolvedValue(apiResponse);

      // When: logout 메서드를 호출
      await repository.logout();

      // Then: 올바른 엔드포인트로 요청
      expect(mockHttpClient.post).toHaveBeenCalledWith('v1/auth/logout');
    });

    it('로그아웃 실패 시 에러를 전파한다', async () => {
      // Given: 서버 에러 상황
      const serverError = new Error('Server error');

      mockHttpClient.post.mockRejectedValue(serverError);

      // When & Then: 에러가 그대로 전파됨
      await expect(repository.logout()).rejects.toThrow('Server error');
    });
  });

  describe('getKakaoAuthUrl', () => {
    it('카카오 OAuth URL을 생성한다', () => {
      // Given: redirect URI
      const redirectUri = 'myapp://auth/kakao';

      // When: getKakaoAuthUrl 메서드를 호출
      const result = repository.getKakaoAuthUrl(redirectUri);

      // Then: 올바른 형식의 URL이 생성됨
      expect(result).toContain('/v1/auth/kakao/start?redirect_uri=myapp%3A%2F%2Fauth%2Fkakao');
    });

    it('redirect URI를 올바르게 인코딩한다', () => {
      // Given: 특수 문자가 포함된 redirect URI
      const redirectUri = 'myapp://auth/callback?param=value&other=test';

      // When: getKakaoAuthUrl 메서드를 호출
      const result = repository.getKakaoAuthUrl(redirectUri);

      // Then: redirect URI가 URL-encoded 됨
      expect(result).toContain('redirect_uri=myapp%3A%2F%2F');
      expect(result).toContain('callback%3Fparam%3Dvalue%26other%3Dtest');
    });
  });
});
