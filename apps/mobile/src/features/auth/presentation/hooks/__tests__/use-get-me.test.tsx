/**
 * useGetMe Hook Tests
 *
 * 현재 로그인된 사용자 정보 조회 Hook의 동작을 검증합니다.
 */

import { TokenStore } from '@src/shared/storage/token-store';
import { AllProvidersWrapper } from '@src/shared/testing/test-utils';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AuthRepositoryStub } from '../../../data/repositories/auth.repository.stub';
import { useGetMe } from '../use-get-me';

describe('useGetMe', () => {
  const authRepositoryStub = new AuthRepositoryStub();

  const wrapper = ({ children }: PropsWithChildren) => (
    <AllProvidersWrapper authRepository={authRepositoryStub}>{children}</AllProvidersWrapper>
  );

  beforeEach(() => {
    authRepositoryStub.reset();
  });

  describe('성공 케이스', () => {
    it('액세스 토큰이 있을 때 사용자 정보를 조회한다', async () => {
      // Given: 액세스 토큰이 저장되어 있음
      await TokenStore.setAccessToken('test-access-token');

      // When: Hook을 렌더링
      const { result } = renderHook(() => useGetMe(), { wrapper });

      // Then: 사용자 정보가 조회되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        userId: expect.any(String),
        email: expect.any(String),
        sessionId: expect.any(String),
        userTag: expect.any(String),
        status: expect.any(String),
        emailVerifiedAt: expect.any(Date),
        subscriptionStatus: expect.any(String),
        subscriptionExpiresAt: null,
        name: expect.any(String),
        profileImage: null,
        createdAt: expect.any(Date),
      });
      expect(authRepositoryStub.getCurrentUserCallCount).toBe(1);
    });

    it('액세스 토큰이 없을 때 null을 반환한다', async () => {
      // Given: 액세스 토큰이 없음
      await TokenStore.deleteAccessToken();

      // When: Hook을 렌더링
      const { result } = renderHook(() => useGetMe(), { wrapper });

      // Then: null이 반환되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
      expect(authRepositoryStub.getCurrentUserCallCount).toBe(0);
    });
  });

  describe('실패 케이스', () => {
    it('네트워크 에러 시 에러 상태를 반환한다', async () => {
      // Given: 액세스 토큰이 있고 Repository가 에러를 던지도록 설정
      await TokenStore.setAccessToken('test-access-token');
      authRepositoryStub.setShouldFail(true);

      // When: Hook을 렌더링
      const { result } = renderHook(() => useGetMe(), { wrapper });

      // Then: 에러 상태가 설정되어야 함
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('에러 발생 시 재시도하지 않는다', async () => {
      // Given: 액세스 토큰이 있고 Repository가 에러를 던지도록 설정
      await TokenStore.setAccessToken('test-access-token');
      authRepositoryStub.setShouldFail(true);

      // When: Hook을 렌더링
      const { result } = renderHook(() => useGetMe(), { wrapper });

      // Then: 에러 발생 후 재시도하지 않아야 함
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(authRepositoryStub.getCurrentUserCallCount).toBe(1);
    });
  });

  describe('로딩 상태', () => {
    it('초기 로딩 중일 때 isPending 상태를 반환한다', () => {
      // Given: 액세스 토큰이 있음
      TokenStore.setAccessToken('test-access-token');

      // When: Hook을 렌더링
      const { result } = renderHook(() => useGetMe(), { wrapper });

      // Then: 즉시 pending 상태여야 함
      expect(result.current.isPending).toBe(true);
    });
  });
});
