import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationCategory } from '@src/core/ports/push-notification-gateway';
import { createTestDi } from '@src/shared/__tests__';
import { createLoggerStub } from '@src/shared/__tests__/create-logger-stub';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPushNotificationGatewayStub } from '../__tests__/notification.fixtures';
import { useMarketingNotificationCategory } from './use-marketing-notification-category';

const logger: Logger = createLoggerStub();

async function setup(registration: Promise<void>) {
  const gateway = createPushNotificationGatewayStub({
    setCategory: jest.fn((_category: PushNotificationCategory) => registration),
  });
  const container = createTestDi({ logger, pushNotificationGateway: gateway });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  await renderHook(() => useMarketingNotificationCategory(), { wrapper });
  return gateway;
}

describe('useMarketingNotificationCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('마케팅 수신 거부 버튼이 앱을 열도록 카테고리를 등록한다', async () => {
    // Given
    // When
    const gateway = await setup(Promise.resolve());

    // Then
    expect(gateway.setCategory).toHaveBeenCalledWith({
      identifier: 'MARKETING',
      actions: [
        expect.objectContaining({ identifier: 'MARKETING_OPT_OUT', opensAppToForeground: true }),
      ],
    });
  });

  it('등록이 실패해도 경고만 남긴다', async () => {
    // Given
    // When
    await setup(Promise.reject(new Error('unavailable')));

    // Then
    await waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(1));
  });
});
