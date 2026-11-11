import '@src/shared/i18n/init';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createLoggerStub,
  createPushNotificationGatewayStub,
  createTestQueryClient,
  renderUiHook,
} from '@src/shared/__tests__';
import { act, waitFor } from '@testing-library/react-native';

import { createPushDeviceResponseDto } from '../__tests__/notification.fixtures';
import type { PushPermission } from '../domains/push-permission.model';
import { NOTIFICATION_QUERY_KEYS } from '../queries/notification-query-keys';
import { usePromptPushPermission } from './use-prompt-push-permission';

async function renderPrompt(permission: PushPermission) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), permission);
  const httpClient = createHttpClientStub();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const pushNotification = createPushNotificationGatewayStub();
  const { result } = await renderUiHook(usePromptPushPermission, {
    queryClient,
    di: {
      httpClient,
      pushNotification,
      analytics: createAnalyticsStub(),
      logger: createLoggerStub(),
    },
  });
  return { promptPushPermission: result.current, pushNotification, queryClient };
}

describe('usePromptPushPermission — 할 일 시간을 정한 순간', () => {
  it('아직 묻지 않았으면 그 자리에서 시스템 창을 띄우고 답을 캐시에 남긴다', async () => {
    // Given
    const { promptPushPermission, pushNotification, queryClient } = await renderPrompt({
      status: 'NOT_DETERMINED',
      canAskAgain: true,
    });

    // When
    await act(async () => promptPushPermission());

    // Then
    await waitFor(() => expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(queryClient.getQueryData(NOTIFICATION_QUERY_KEYS.permission())?.status).toBe(
        'GRANTED',
      ),
    );
  });

  it.each([
    ['거절했으면', { status: 'DENIED', canAskAgain: false }],
    ['Android에서 한 번 거절했어도', { status: 'DENIED', canAskAgain: true }],
    ['이미 허용했으면', { status: 'GRANTED', canAskAgain: false }],
  ] as const)('%s 시스템 창을 띄우지 않는다', async (_label, permission) => {
    // Given
    const { promptPushPermission, pushNotification } = await renderPrompt(permission);

    // When
    await act(async () => promptPushPermission());

    // Then
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
  });
});
