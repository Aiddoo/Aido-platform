import '@src/shared/i18n/init';
import { i18n } from '@src/shared/i18n';
import { createPushNotificationGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { useRegisterMarketingNotificationCategory } from './use-register-marketing-notification-category';

describe('useRegisterMarketingNotificationCategory', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('앱 안에서 언어를 바꾸면 수신 거부 버튼 문구를 새 언어로 다시 등록한다', async () => {
    // Given
    await i18n.changeLanguage('ko');
    const gateway = createPushNotificationGatewayStub();
    await renderScreenHook(() => useRegisterMarketingNotificationCategory(), {
      di: createTestDi({ ports: { pushNotification: gateway } }),
    });

    // When
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    // Then
    const titles = gateway.setCategory.mock.calls.map(([category]) => category.actions[0]?.title);
    expect(titles).toHaveLength(2);
    expect(titles[0]).not.toBe(titles[1]);
  });
});
