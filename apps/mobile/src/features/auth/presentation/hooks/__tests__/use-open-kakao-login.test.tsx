/**
 * useOpenKakaoLogin Hook Tests
 *
 * 카카오 로그인 WebBrowser 열기 Hook의 동작을 검증합니다.
 */

import { AllProvidersWrapper } from '@src/shared/testing/test-utils';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import type { PropsWithChildren } from 'react';
import { AuthRepositoryStub } from '../../../data/repositories/auth.repository.stub';
import { useOpenKakaoLogin } from '../use-open-kakao-login';

// WebBrowser 모킹
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

// Linking 모킹
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `exp://localhost/${path}`),
  parse: jest.fn((url: string) => {
    // URL 파싱 시뮬레이션
    const queryParams: Record<string, string> = {};
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    return { queryParams };
  }),
}));

describe('useOpenKakaoLogin', () => {
  const authRepositoryStub = new AuthRepositoryStub();
  const mockOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.Mock;

  const wrapper = ({ children }: PropsWithChildren) => (
    <AllProvidersWrapper authRepository={authRepositoryStub}>{children}</AllProvidersWrapper>
  );

  beforeEach(() => {
    authRepositoryStub.reset();
    jest.clearAllMocks();
  });

  describe('성공 케이스', () => {
    it('카카오 로그인 WebBrowser를 열고 인증 코드를 반환한다', async () => {
      // Given: WebBrowser가 성공 결과를 반환하도록 모킹
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: 'exp://localhost/auth/kakao?code=mock-auth-code',
      });

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useOpenKakaoLogin(), { wrapper });

      result.current.mutate();

      // Then: 성공적으로 인증 코드를 받아야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe('mock-auth-code');
      expect(authRepositoryStub.getKakaoAuthUrlCallCount).toBe(1);
      expect(mockOpenAuthSessionAsync).toHaveBeenCalledTimes(1);
    });

    it('사용자가 취소하면 null을 반환한다', async () => {
      // Given: WebBrowser가 취소 결과를 반환하도록 모킹
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'cancel',
      });

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useOpenKakaoLogin(), { wrapper });

      result.current.mutate();

      // Then: null이 반환되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
      expect(authRepositoryStub.getKakaoAuthUrlCallCount).toBe(1);
      expect(mockOpenAuthSessionAsync).toHaveBeenCalledTimes(1);
    });

    it('URL에 code가 없으면 null을 반환한다', async () => {
      // Given: WebBrowser가 code가 없는 URL을 반환하도록 모킹
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: 'exp://localhost/auth/kakao',
      });

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useOpenKakaoLogin(), { wrapper });

      result.current.mutate();

      // Then: null이 반환되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('실패 케이스', () => {
    it('WebBrowser 에러 시 에러 상태를 반환한다', async () => {
      // Given: WebBrowser가 에러를 던지도록 모킹
      mockOpenAuthSessionAsync.mockRejectedValue(new Error('WebBrowser error'));

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useOpenKakaoLogin(), { wrapper });

      result.current.mutate();

      // Then: 에러 상태가 설정되어야 함
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('Repository 에러 시 에러 상태를 반환한다', async () => {
      // Given: Repository가 에러를 던지도록 설정
      authRepositoryStub.setShouldFail(true);

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useOpenKakaoLogin(), { wrapper });

      result.current.mutate();

      // Then: 에러 상태가 설정되어야 함
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('로딩 상태', () => {
    it('mutation이 완료될 때까지 대기하고 성공 상태가 된다', async () => {
      // Given: WebBrowser가 성공 결과를 반환하도록 모킹
      mockOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: 'exp://localhost/auth/kakao?code=mock-auth-code',
      });

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useOpenKakaoLogin(), { wrapper });

      // mutation 실행 전 idle 상태 확인
      expect(result.current.isIdle).toBe(true);

      result.current.mutate();

      // Then: 완료될 때까지 대기 후 성공 상태 확인
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // 완료 후 pending이 아님을 확인
      expect(result.current.isPending).toBe(false);
    });
  });
});
