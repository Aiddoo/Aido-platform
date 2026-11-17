import '@src/shared/i18n/init';
import { i18n } from '@src/shared/i18n';
import { createPushNotificationGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { useRegisterNotificationCategories } from './use-register-notification-categories';

describe('useRegisterNotificationCategories', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('서버 categoryId마다 버튼을 등록하고, 리마인드 알림 버튼은 누르면 앱을 연다', async () => {
    // Given
    await i18n.changeLanguage('ko');
    const gateway = createPushNotificationGatewayStub();

    // When
    await renderScreenHook(() => useRegisterNotificationCategories(), {
      di: createTestDi({ ports: { pushNotification: gateway } }),
    });

    // Then
    expect(gateway.setCategory.mock.calls.map(([category]) => category)).toEqual([
      expect.objectContaining({ identifier: 'MARKETING' }),
      {
        identifier: 'TODO_REMINDER',
        actions: [
          { identifier: 'complete', title: '완료', opensAppToForeground: true },
          { identifier: 'snooze', title: '10분 뒤 다시', opensAppToForeground: true },
        ],
      },
    ]);
  });

  it('앱 안에서 언어를 바꾸면 버튼 문구를 새 언어로 다시 등록한다', async () => {
    // Given
    await i18n.changeLanguage('ko');
    const gateway = createPushNotificationGatewayStub();
    await renderScreenHook(() => useRegisterNotificationCategories(), {
      di: createTestDi({ ports: { pushNotification: gateway } }),
    });

    // When
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    // Then
    const reminderTitles = gateway.setCategory.mock.calls
      .filter(([category]) => category.identifier === 'TODO_REMINDER')
      .map(([category]) => category.actions.map(({ title }) => title));
    const marketingTitles = gateway.setCategory.mock.calls
      .filter(([category]) => category.identifier === 'MARKETING')
      .map(([category]) => category.actions[0]?.title);
    expect(reminderTitles).toEqual([
      ['완료', '10분 뒤 다시'],
      ['Done', 'Remind in 10 min'],
    ]);
    expect(marketingTitles).toHaveLength(2);
    expect(marketingTitles[0]).not.toBe(marketingTitles[1]);
  });
});
