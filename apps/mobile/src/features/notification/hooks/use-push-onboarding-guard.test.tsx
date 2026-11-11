import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { getNowInstant } from '@src/shared/date/clock';
import {
  createMemoryObservableSyncStorage,
  createPushNotificationGatewayStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { waitFor } from '@testing-library/react-native';

import { createPushPermissionResponse } from '../__tests__/notification.fixtures';
import {
  useIsPushOnboardingGuardClosed,
  useIsPushOnboardingGuardOpen,
  usePushOnboardingGuard,
} from './use-push-onboarding-guard';

async function renderGuard(getPermission: () => Promise<PushPermissionResponse>) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  // 방금 가입해 알림 화면을 보여 줄 수 있는 기간 안이다
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ createdAt: getNowInstant() }));
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockImplementation(getPermission);

  return renderScreenHook(
    () => {
      usePushOnboardingGuard();
      return { isOpen: useIsPushOnboardingGuardOpen(), isClosed: useIsPushOnboardingGuardClosed() };
    },
    {
      queryClient,
      di: {
        authSessionStore: createAuthSessionStoreStub('authenticated'),
        syncStorage: createMemoryObservableSyncStorage(),
        pushNotification,
      },
    },
  );
}

describe('usePushOnboardingGuard — 다른 자동 화면이 기다리는 신호', () => {
  it('권한을 읽기 전에는 열지도 닫지도 않아 다른 화면이 알림 화면보다 앞서지 않는다', async () => {
    // When
    const { result } = await renderGuard(() => new Promise(() => undefined));

    // Then
    expect(result.current).toEqual({ isOpen: false, isClosed: false });
  });

  it('새 계정이 아직 답하지 않았으면 알림 화면 차례라 닫히지 않는다', async () => {
    // When
    const { result } = await renderGuard(async () =>
      createPushPermissionResponse({ status: 'undetermined', canAskAgain: true }),
    );

    // Then
    await waitFor(() => expect(result.current).toEqual({ isOpen: true, isClosed: false }));
  });

  it('알림을 이미 허용했으면 닫혀 다른 화면이 열릴 수 있다', async () => {
    // When
    const { result } = await renderGuard(async () => createPushPermissionResponse());

    // Then
    await waitFor(() => expect(result.current).toEqual({ isOpen: false, isClosed: true }));
  });

  it('권한을 읽지 못하면 알림 화면을 띄울 수 없으므로 닫힌다', async () => {
    // When
    const { result } = await renderGuard(async () => {
      throw new Error('permission unavailable');
    });

    // Then
    await waitFor(() => expect(result.current).toEqual({ isOpen: false, isClosed: true }));
  });
});
