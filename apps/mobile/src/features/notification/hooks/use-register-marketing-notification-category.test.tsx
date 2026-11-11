import '@src/shared/i18n/init';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { i18n } from '@src/shared/i18n';
import {
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useRegisterMarketingNotificationCategory } from './use-register-marketing-notification-category';

describe('useRegisterMarketingNotificationCategory', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('앱 안에서 언어를 바꾸면 수신 거부 버튼 문구를 새 언어로 다시 등록한다', async () => {
    // Given
    await i18n.changeLanguage('ko');
    const gateway = createPushNotificationGatewayStub();
    const container = createTestDi({ pushNotification: gateway });
    const wrapper = ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );
    await renderHook(() => useRegisterMarketingNotificationCategory(), { wrapper });

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
