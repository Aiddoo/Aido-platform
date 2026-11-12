import { ok } from '@src/core/errors/result';
import type { AuthStatus } from '@src/core/session/auth-status';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { NetworkError, ServerError } from '@src/shared/errors';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createAppLoggerStub,
  createPendingResponse,
  createPushNotificationGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { Slot } from 'expo-router';
import { act, waitFor } from 'expo-router/testing-library';

import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '../constants/notification.constants';
import { usePushNotificationResponse } from './use-push-notification-response';

jest.unmock('expo-router');

const RESPONSE = {
  id: 'response-1',
  actionIdentifier: 'default',
  data: { notificationId: 0, type: 'FOLLOW_NEW', action: { type: 'NONE' } },
};

async function setup({ status }: { status: AuthStatus }) {
  const gateway = createPushNotificationGatewayStub();
  const logger = createAppLoggerStub();
  const authSessionStore = createAuthSessionStoreStub(status);
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  const errorReporter = createErrorReporterStub();
  const di = createTestDi({
    ports: { httpClient, pushNotification: gateway, logger, analytics, errorReporter },
    seeds: { authSessionStore },
  });

  function Layout() {
    usePushNotificationResponse();
    return <Slot />;
  }

  await renderAppRoute(
    { _layout: Layout, index: () => null },
    { url: '/', di, withLocalDate: true },
  );
  return {
    gateway,
    httpClient,
    analytics,
    errorReporter,
    logger,
    store: di.pushNotificationEntryStore,
    changeStatus: (next: AuthStatus) => act(async () => authSessionStore.setStatus(next)),
    // 로그아웃은 토큰을 지워 세션 세대를 올리고 상태를 바꾼다
    signOut: () =>
      act(async () => {
        await di.tokenStore.clear();
        authSessionStore.setStatus('unauthenticated');
      }),
  };
}

describe('usePushNotificationResponse', () => {
  it('눌린 응답을 슬롯에 받고 같은 알림이면 다시 받지 않는다', async () => {
    // Given
    const { gateway, store } = await setup({ status: 'unauthenticated' });
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    await act(async () => gateway.emitResponse(RESPONSE));
    await act(async () => gateway.emitResponse(RESPONSE));

    // Then
    expect(store.getSnapshot().pending?.id).toBe('response-1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('서버의 새 navigation은 버려 알림함으로 열고 버린 칸의 경로를 남긴다', async () => {
    // Given
    const { gateway, logger, store } = await setup({ status: 'authenticated' });

    // When
    await act(async () =>
      gateway.emitResponse({
        ...RESPONSE,
        data: { ...RESPONSE.data, navigation: { kind: 'NEW_SCREEN' } },
      }),
    );

    // Then
    expect(store.getSnapshot().ready?.destination).toEqual({
      kind: 'route',
      href: '/notifications',
    });
    expect(logger.warn).toHaveBeenCalledWith('notification.push.parse-dropped', {
      source: 'response',
      responseId: 'response-1',
      droppedPaths: 'navigation.kind',
      isReadable: true,
    });
  });

  it('로그아웃하면 슬롯과 마지막 응답을 지운다', async () => {
    // Given
    const { gateway, store, changeStatus } = await setup({ status: 'authenticated' });
    gateway.setLastResponse(RESPONSE);

    // When
    await changeStatus('unauthenticated');

    // Then
    expect(store.getSnapshot().pending).toBeNull();
    expect(gateway.getLastResponse()).toBeNull();
  });

  it('마지막 응답 지우기가 실패해도 경고만 남긴다', async () => {
    // Given
    const { gateway, logger, changeStatus } = await setup({ status: 'authenticated' });
    gateway.clearLastResponse.mockImplementation(() => {
      throw new Error('unavailable');
    });

    // When
    await changeStatus('unauthenticated');

    // Then
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('미인증 상태에서 받은 응답은 잠금 해제나 로그인 전까지 슬롯에 남는다', async () => {
    // Given
    const { gateway, store, changeStatus } = await setup({ status: 'unauthenticated' });
    await act(async () => gateway.emitResponse(RESPONSE));

    // When
    await changeStatus('locked');

    // Then
    expect(store.getSnapshot().pending?.id).toBe('response-1');
  });

  it('Index가 이동하지 못해도 상한이 지나면 슬롯을 비워 갇히지 않는다', async () => {
    // Given
    const { gateway, logger, store } = await setup({ status: 'authenticated' });

    // When
    await act(async () => gateway.emitResponse(RESPONSE));
    expect(store.getSnapshot().ready?.response.id).toBe('response-1');

    // Then
    await waitFor(() => expect(store.getSnapshot().ready).toBeNull(), {
      timeout: NOTIFICATION_ENTRY_HOLD_MAX_MS + 1000,
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('Index가 이동하지 못해 피드로 보내도 서버 기록이 있는 알림은 열람을 남긴다', async () => {
    // Given
    const { gateway, httpClient, store } = await setup({ status: 'authenticated' });

    // When
    await act(async () =>
      gateway.emitResponse({ ...RESPONSE, data: { ...RESPONSE.data, notificationId: 75 } }),
    );

    // Then
    await waitFor(() => expect(store.getSnapshot().ready).toBeNull(), {
      timeout: NOTIFICATION_ENTRY_HOLD_MAX_MS + 1000,
    });
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith('v1/notifications/75/opened'));
  });

  it('수신 거부를 보내는 사이 로그아웃하면 끝난 결과를 기록하거나 응답을 다시 지우지 않는다', async () => {
    // Given
    const { gateway, httpClient, analytics, signOut } = await setup({
      status: 'authenticated',
    });
    const optOut = createPendingResponse(
      ok({ optedOut: true, marketingPushWithdrawnAt: '2026-11-09T03:00:00.000Z' }),
    );
    httpClient.post.mockReturnValueOnce(optOut.response);
    await act(async () =>
      gateway.emitResponse({
        ...RESPONSE,
        id: 'opt-out',
        actionIdentifier: 'MARKETING_OPT_OUT',
        data: { ...RESPONSE.data, marketingOptOutToken: 'token-1' },
      }),
    );
    await signOut();
    gateway.clearLastResponse.mockClear();

    // When
    await act(async () => optOut.settle());

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'marketing_push_opted_out',
      expect.anything(),
    );
    expect(gateway.clearLastResponse).not.toHaveBeenCalled();
  });

  it.each([
    { scenario: '서버 오류(5xx)', error: new ServerError(500), reportCount: 1 },
    { scenario: '연결 끊김', error: new NetworkError(), reportCount: 0 },
  ])(
    '수신 거부가 $scenario로 실패하면 다음에 다시 보내고 예상하지 못한 실패만 $reportCount번 보고한다',
    async ({ error, reportCount }) => {
      // Given
      const { gateway, httpClient, errorReporter } = await setup({ status: 'authenticated' });
      httpClient.post.mockRejectedValueOnce(error);

      // When
      await act(async () =>
        gateway.emitResponse({
          ...RESPONSE,
          id: 'opt-out',
          actionIdentifier: 'MARKETING_OPT_OUT',
          data: { ...RESPONSE.data, marketingOptOutToken: 'token-1' },
        }),
      );

      // Then
      await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
      await act(async () => {});
      expect(errorReporter.captureException).toHaveBeenCalledTimes(reportCount);
      expect(gateway.clearLastResponse).not.toHaveBeenCalled();
    },
  );

  it('언마운트 전까지 응답 리스너는 하나다', async () => {
    // Given
    const { gateway } = await setup({ status: 'unauthenticated' });

    // When
    const count = gateway.getListenerCount();

    // Then
    expect(count).toBe(1);
  });
});
