import '@src/shared/i18n/init';
import { NIGHT_TIME_CONFIG, type SupportedLocale } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { formatHourLabel, type TimeFormat } from '@src/shared/date/format/date-format';
import { i18n } from '@src/shared/i18n';
import { APP_LOCALES } from '@src/shared/i18n/app-locales';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import {
  createPushDeviceResponseDto,
  createPushPermission,
} from '../__tests__/notification.fixtures';
import { PUSH_PERMISSION_QUERY_KEYS } from '../queries/push-permission-query-keys';
import { PushDeliverySettings } from './push-delivery-settings';

async function renderSettings({ pushEnabled }: { pushEnabled: boolean }) {
  const analytics = createAnalyticsStub();
  const pushNotification = createPushNotificationGatewayStub();
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue(ok(createPreferenceDto({ pushEnabled: !pushEnabled })));
  httpClient.put.mockResolvedValue(ok(createPushDeviceResponseDto()));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled })),
  );
  queryClient.setQueryData(PUSH_PERMISSION_QUERY_KEYS.current(), createPushPermission());

  await renderScreen(
    <Suspense fallback={null}>
      <PushDeliverySettings />
    </Suspense>,
    {
      di: createTestDi({ ports: { analytics, httpClient, pushNotification, queryClient } }),
      withLocalDate: true,
    },
  );
  const pushToggle = await screen.findByText('푸시 알림');
  const getPushPermissionEvents = () =>
    analytics.trackEvent.mock.calls.filter(([name]) => name.startsWith('push_permission_'));

  return { pushToggle, pushNotification, getPushPermissionEvents };
}

describe('PushDeliverySettings', () => {
  it('앱 푸시를 켜면 저장한 뒤 권한을 묻고 설정에서 물었다고 한 번 남긴다', async () => {
    // Given
    const { pushToggle, pushNotification, getPushPermissionEvents } = await renderSettings({
      pushEnabled: false,
    });

    // When
    await userEvent.press(pushToggle);

    // Then
    await waitFor(() => expect(getPushPermissionEvents()).toHaveLength(1));
    expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(getPushPermissionEvents()).toEqual([
      ['push_permission_requested', { source: 'settings', status: 'GRANTED' }],
    ]);
  });

  it('앱 푸시를 끄면 권한을 묻지 않는다', async () => {
    // Given
    const { pushToggle, pushNotification, getPushPermissionEvents } = await renderSettings({
      pushEnabled: true,
    });

    // When
    await userEvent.press(pushToggle);

    // Then
    expect(await screen.findAllByText('푸시 알림을 먼저 활성화해주세요')).not.toHaveLength(0);
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
    expect(getPushPermissionEvents()).toEqual([]);
  });
});

describe('야간 알림 설명', () => {
  it.each([
    ['ko', 'TWELVE_HOUR', '오후 9시부터 오전 8시까지도'],
    ['ko', 'TWENTY_FOUR_HOUR', '21시부터 8시까지도'],
    ['en', 'TWELVE_HOUR', 'from 9 PM to 8 AM'],
  ] as const satisfies readonly (readonly [SupportedLocale, TimeFormat, string])[])(
    '%s %s는 야간 시각을 "%s"로 쓴다',
    (locale, timeFormat, expected) => {
      // Given
      const context = { locale: APP_LOCALES[locale].intlLocale, timezone: 'Asia/Seoul' };
      const t = i18n.getFixedT(locale, 'notification');

      // When
      const description = t('settings.nightPushDescription', {
        start: formatHourLabel(NIGHT_TIME_CONFIG.START_HOUR, timeFormat, context),
        end: formatHourLabel(NIGHT_TIME_CONFIG.END_HOUR, timeFormat, context),
      });

      // Then
      expect(description.replaceAll('\u00A0', ' ')).toContain(expected);
    },
  );
});
