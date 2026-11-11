import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { createPushDeviceResponseDto } from '../__tests__/notification.fixtures';
import { PUSH_PERMISSION_STEP } from '../constants/notification.constants';
import type { PushPermissionPromptSource } from '../constants/notification.events';
import { usePushPermissionAction } from './use-push-permission-action';

/** 권한 단계를 여는 모든 UI. 새 입구를 더하면 여기에도 더한다 */
const SOURCES = [
  'onboarding',
  'todo_time',
  'feed_card',
  'settings',
  'paywall',
  'invite_welcome',
] as const satisfies readonly PushPermissionPromptSource[];

async function renderAction(source: PushPermissionPromptSource) {
  const analytics = createAnalyticsStub();
  const pushNotification = createPushNotificationGatewayStub();
  const externalLink = createExternalLinkGatewayStub();
  const httpClient = createHttpClientStub();
  // 권한을 물은 뒤 기기 상태를 서버에 알리고, 앱 알림을 켜면 설정을 저장한다
  httpClient.put.mockResolvedValue(ok(createPushDeviceResponseDto()));
  httpClient.patch.mockResolvedValue(ok(createPreferenceDto({ pushEnabled: true })));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled: false })),
  );
  const { result } = await renderScreenHook(() => usePushPermissionAction({ source }), {
    queryClient,
    di: {
      analytics,
      httpClient,
      pushNotification,
      externalLink,
    },
  });
  const getPushPermissionEvents = () =>
    analytics.trackEvent.mock.calls.filter(([name]) => name.startsWith('push_permission_'));

  return { result, analytics, pushNotification, externalLink, getPushPermissionEvents };
}

describe('usePushPermissionAction', () => {
  it.each(SOURCES)('%s에서 권한을 물으면 시스템 창 결과를 한 번만 남긴다', async (source) => {
    // Given
    const { result, getPushPermissionEvents } = await renderAction(source);

    // When
    await act(async () => result.current.runStep(PUSH_PERMISSION_STEP.ASK));

    // Then
    await waitFor(() => expect(getPushPermissionEvents()).toHaveLength(1));
    expect(getPushPermissionEvents()).toEqual([
      ['push_permission_requested', { source, status: 'GRANTED' }],
    ]);
  });

  it.each(SOURCES)('%s에서 기기 설정을 열면 한 번만 남긴다', async (source) => {
    // Given
    const { result, getPushPermissionEvents } = await renderAction(source);

    // When
    await act(async () => result.current.runStep(PUSH_PERMISSION_STEP.OPEN_SETTINGS));

    // Then
    await waitFor(() => expect(getPushPermissionEvents()).toHaveLength(1));
    expect(getPushPermissionEvents()).toEqual([['push_permission_settings_opened', { source }]]);
  });

  it.each([
    [
      '권한 창을 띄우지 못하면',
      PUSH_PERMISSION_STEP.ASK,
      ({ pushNotification }: Awaited<ReturnType<typeof renderAction>>) =>
        pushNotification.requestPermission.mockRejectedValue(new Error('unavailable')),
    ],
    [
      '기기 설정을 열지 못하면',
      PUSH_PERMISSION_STEP.OPEN_SETTINGS,
      ({ externalLink }: Awaited<ReturnType<typeof renderAction>>) =>
        externalLink.openSettings.mockRejectedValue(new Error('unavailable')),
    ],
  ] as const)(
    '%s 권한 이벤트를 남기지 않고 부른 쪽의 onError를 부른다',
    async (_case, step, fail) => {
      // Given
      const rendered = await renderAction('onboarding');
      fail(rendered);
      const onError = jest.fn();

      // When
      await act(async () => rendered.result.current.runStep(step, { onError }));

      // Then
      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(rendered.getPushPermissionEvents()).toEqual([]);
    },
  );

  it('앱 알림만 켜는 단계는 권한 창이 뜨지 않아 권한 이벤트 없이 설정 변경 하나만 남긴다', async () => {
    // Given
    const { result, analytics, getPushPermissionEvents } = await renderAction('paywall');

    // When
    await act(async () => result.current.runStep(PUSH_PERMISSION_STEP.ENABLE_IN_APP));

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('settings_changed', {
        setting: 'pushEnabled',
        value: 'true',
      }),
    );
    expect(getPushPermissionEvents()).toEqual([]);
  });
});
