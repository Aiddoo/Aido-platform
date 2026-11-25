import { ok } from '@src/core/errors/result';
import { createConsentDto } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';

import PushSettingsScreen from '../../../../app/(app)/(tabs)/(me,memos,todos)/settings/notifications/push';
import { createPushDeviceResponseDto } from './notification.fixtures';

const PREFERENCE_PATH = 'v1/auth/preference';
const MARKETING_PUSH_CONSENT_PATH = 'v1/auth/consent/marketing-push';
/** 기기 stub이 내주는 토큰. 보고에는 이 값이 그대로 실려야 한다 */
const ISSUED_TOKEN = 'stub-issued-token';
// 화면 제목도 "푸시 알림"이라 토글은 스위치 이름의 앞머리로 찾는다(야간 푸시 알림과 겹치지 않는다)
const PUSH_SWITCH = /^푸시 알림/;
const MARKETING_PUSH_SWITCH = /^광고성 앱 푸시/;

async function renderPushSettings({ pushEnabled }: { pushEnabled: boolean }) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      [PREFERENCE_PATH]: ok(createPreferenceDto({ pushEnabled })),
      'v1/auth/consent': ok(createConsentDto()),
    }),
  );
  httpClient.patch.mockImplementation(
    respondByPath({
      [PREFERENCE_PATH]: ok(createPreferenceDto({ pushEnabled: !pushEnabled })),
      [MARKETING_PUSH_CONSENT_PATH]: ok({
        marketingPushAgreedAt: '2026-11-20T03:00:00.000Z',
        marketingPushWithdrawnAt: null,
      }),
    }),
  );
  httpClient.put.mockResolvedValue(ok(createPushDeviceResponseDto()));
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getToken.mockResolvedValue(ISSUED_TOKEN);
  const analytics = createAnalyticsStub();
  await renderScreen(<PushSettingsScreen />, {
    di: createTestDi({ ports: { httpClient, pushNotification, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByRole('switch', { name: PUSH_SWITCH });
  await screen.findByRole('switch', { name: MARKETING_PUSH_SWITCH });

  return { httpClient, pushNotification, analytics };
}

describe('PushSettingsScreen', () => {
  it('앱 푸시를 끄면 설정만 한 번 저장하고 권한을 묻지 않는다', async () => {
    // Given
    const { httpClient, pushNotification } = await renderPushSettings({ pushEnabled: true });

    // When
    await userEvent.press(screen.getByRole('switch', { name: PUSH_SWITCH }));

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledWith(PREFERENCE_PATH, { pushEnabled: false });
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
  });

  it('앱 푸시를 켜면 저장한 뒤 권한을 묻고 그 기기 상태를 서버에 보고한다', async () => {
    // Given
    const { httpClient, pushNotification } = await renderPushSettings({ pushEnabled: false });

    // When
    await userEvent.press(screen.getByRole('switch', { name: PUSH_SWITCH }));

    // Then
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledWith(PREFERENCE_PATH, { pushEnabled: true });
    expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1);
    const [devicePath, deviceBody] = httpClient.put.mock.calls[0] ?? [];
    expect(devicePath).toMatch(/^v1\/notifications\/push-devices\//);
    expect(deviceBody).toEqual(
      expect.objectContaining({
        permission: expect.objectContaining({ status: 'GRANTED' }),
        token: ISSUED_TOKEN,
      }),
    );
  });

  it('광고성 앱 푸시를 켜면 동의를 한 번 보내고 설정에서 동의했다고 남긴다', async () => {
    // Given
    const { httpClient, analytics } = await renderPushSettings({ pushEnabled: true });

    // When
    await userEvent.press(screen.getByRole('switch', { name: MARKETING_PUSH_SWITCH }));

    // Then
    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(MARKETING_PUSH_CONSENT_PATH, { agreed: true }),
    );
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('marketing_push_opted_in', {
        source: 'settings',
      }),
    );
  });
});
