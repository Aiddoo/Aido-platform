import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createHttpClientStub,
  createTestDi,
  respondByPath,
  silenceConsole,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import ReminderSettingsScreen from '../../../../app/(app)/(tabs)/(me,memos,todos)/settings/notifications/reminder';

const PREFERENCE_PATH = 'v1/auth/preference';
const MORNING_LABEL = '오전 리마인드';

type HostNode = ReturnType<typeof screen.getByText>;

/** 시트 안 iOS 시각 휠. 접근성 이름이 없어 UTC 벽시계로 시각을 주고받는 피커 속성으로 찾는다 */
function findTimeSpinner(): HostNode {
  const visit = (node: HostNode): HostNode | null => {
    if (node.props.timeZoneName === 'UTC' && node.props.date != null) {
      return node;
    }
    for (const child of node.children) {
      if (typeof child !== 'string') {
        const found = visit(child);
        if (found != null) {
          return found;
        }
      }
    }
    return null;
  };
  const spinner = screen.root == null ? null : visit(screen.root);
  if (spinner == null) {
    throw new Error('시각 휠이 없습니다');
  }
  return spinner;
}

/** 휠은 시와 분을 UTC 벽시계로 주고받는다 */
async function spinTo(hour: number, minute: number) {
  await fireEvent(findTimeSpinner(), 'change', {
    nativeEvent: { timestamp: Date.UTC(2000, 0, 15, hour, minute) },
  });
}

async function renderReminderSettings({
  tier,
  saved = ok(createPreferenceDto()),
}: {
  tier: 'FREE' | 'PREMIUM';
  saved?: Awaited<ReturnType<HttpClient['patch']>>;
}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/entitlements': ok(createEntitlementSnapshotDto({ tier })),
      [PREFERENCE_PATH]: ok(createPreferenceDto()),
    }),
  );
  httpClient.patch.mockResolvedValue(saved);
  await renderScreen(<ReminderSettingsScreen />, {
    di: createTestDi({ ports: { httpClient } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByText(MORNING_LABEL);

  return { httpClient };
}

describe('ReminderSettingsScreen', () => {
  it('프리미엄이 오전 시각을 돌려 확인하면 그 시각을 한 번 저장하고 보인다', async () => {
    // Given
    const { httpClient } = await renderReminderSettings({
      tier: 'PREMIUM',
      saved: ok(createPreferenceDto({ morningReminderHour: 9, morningReminderMinute: 30 })),
    });
    await fireEvent.press(screen.getByText(MORNING_LABEL));
    const confirm = await screen.findByText('확인');
    await spinTo(9, 30);

    // When
    await fireEvent.press(confirm);

    // Then
    expect(await screen.findByText('오전 9:30')).toBeOnTheScreen();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith(PREFERENCE_PATH, {
      morningReminderHour: 9,
      morningReminderMinute: 30,
    });
  });

  it('시각을 저장하지 못하면 알리고 원래 시각을 보인다', async () => {
    // Given
    await renderReminderSettings({ tier: 'PREMIUM', saved: fail(new NetworkError()) });
    await fireEvent.press(screen.getByText(MORNING_LABEL));
    const confirm = await screen.findByText('확인');
    await spinTo(9, 30);

    // When
    await fireEvent.press(confirm);

    // Then
    expect(await screen.findByText('인터넷 연결을 확인해주세요')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('오전 8:00')).toBeOnTheScreen());
    expect(screen.queryByText('오전 9:30')).toBeNull();
  });

  it('무료면 시각 휠을 열지 않고 프리미엄 안내를 띄운다', async () => {
    // Given
    const { httpClient } = await renderReminderSettings({ tier: 'FREE' });

    // When
    await fireEvent.press(screen.getByText(MORNING_LABEL));

    // Then
    expect(await screen.findByRole('button', { name: '프리미엄 보기' })).toBeOnTheScreen();
    expect(screen.queryByText('확인')).toBeNull();
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('설정을 받지 못하면 다시 시도를 보이고 누르면 다시 받아 시각을 보인다', async () => {
    // Given
    // 조회 경계가 잡은 오류를 React가 console.error로 다시 찍는다
    silenceConsole('error');
    const httpClient = createHttpClientStub();
    let preferenceRequestCount = 0;
    httpClient.get.mockImplementation(
      respondByPath({
        'v1/entitlements': ok(createEntitlementSnapshotDto({ tier: 'PREMIUM' })),
        [PREFERENCE_PATH]: async () => {
          preferenceRequestCount += 1;
          return preferenceRequestCount === 1
            ? fail(new NetworkError())
            : ok(createPreferenceDto());
        },
      }),
    );
    await renderScreen(<ReminderSettingsScreen />, {
      di: createTestDi({ ports: { httpClient } }),
      withLocalDate: true,
      withOverlay: true,
    });

    // When
    await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

    // Then
    expect(await screen.findByText('오전 8:00')).toBeOnTheScreen();
    expect(screen.getByText('오후 9:00')).toBeOnTheScreen();
    expect(preferenceRequestCount).toBe(2);
  });
});
