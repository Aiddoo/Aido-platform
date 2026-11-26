import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestDi,
  getTrackedEvents,
  silenceConsole,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import NotificationSettingsScreen from '../../../../app/(app)/(tabs)/(me,memos,todos)/settings/notifications/index';

const PREFERENCE_PATH = 'v1/auth/preference';
const TIME_FORMAT_SWITCH = /^24시간제/;

async function renderNotificationSettings(httpClient: ReturnType<typeof createHttpClientStub>) {
  const analytics = createAnalyticsStub();
  await renderScreen(<NotificationSettingsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });

  return { analytics };
}

describe('NotificationSettingsScreen', () => {
  it('24시간제를 켜면 시간 표시만 한 번 저장하고 알림 시각을 24시간제로 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createPreferenceDto()));
    httpClient.patch.mockResolvedValue(ok(createPreferenceDto({ timeFormat: 'TWENTY_FOUR_HOUR' })));
    const { analytics } = await renderNotificationSettings(httpClient);
    expect(await screen.findByText('오전 8:00 / 오후 9:00')).toBeOnTheScreen();

    // When
    await userEvent.press(screen.getByRole('switch', { name: TIME_FORMAT_SWITCH }));

    // Then
    expect(await screen.findByText('08:00 / 21:00')).toBeOnTheScreen();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith(PREFERENCE_PATH, {
      timeFormat: 'TWENTY_FOUR_HOUR',
    });
    await waitFor(() =>
      expect(getTrackedEvents(analytics, 'settings_changed')).toEqual([
        { setting: 'timeFormat', value: 'TWENTY_FOUR_HOUR' },
      ]),
    );
  });

  it('연결이 없어 저장하지 못하면 알리고 시간 표시를 원래 값으로 되돌린다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createPreferenceDto()));
    httpClient.patch.mockResolvedValue(fail(new NetworkError()));
    await renderNotificationSettings(httpClient);
    await screen.findByText('오전 8:00 / 오후 9:00');

    // When
    await userEvent.press(screen.getByRole('switch', { name: TIME_FORMAT_SWITCH }));

    // Then
    expect(await screen.findByText('인터넷 연결을 확인해주세요')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: TIME_FORMAT_SWITCH })).not.toBeChecked(),
    );
    expect(screen.getByText('오전 8:00 / 오후 9:00')).toBeOnTheScreen();
  });

  it('설정을 받지 못하면 다시 시도를 보이고 누르면 다시 받아 설정을 보인다', async () => {
    // Given
    // 조회 경계가 잡은 오류를 React가 console.error로 다시 찍는다
    silenceConsole('error');
    const httpClient = createHttpClientStub();
    httpClient.get
      .mockResolvedValueOnce(fail(new NetworkError()))
      .mockResolvedValue(ok(createPreferenceDto()));
    await renderNotificationSettings(httpClient);

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

    // Then
    expect(await screen.findByText('오전 8:00 / 오후 9:00')).toBeOnTheScreen();
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it('리마인드 알림을 누르면 알림 시간 설정으로 간다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createPreferenceDto()));
    await renderNotificationSettings(httpClient);

    // When
    await fireEvent.press(await screen.findByText('리마인드 알림'));

    // Then
    expect(router.push).toHaveBeenCalledWith('/settings/notifications/reminder');
  });
});
