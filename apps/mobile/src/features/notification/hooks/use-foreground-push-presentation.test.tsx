import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/shared/__tests__';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useForegroundPushPresentation } from './use-foreground-push-presentation';

const NUDGE_PUSH = {
  data: {
    notificationId: 7,
    type: 'NUDGE_RECEIVED',
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'NUDGE', nudgeId: 5 },
  },
};

async function setup({ pathname, params }: { pathname: string; params: Record<string, string> }) {
  jest.mocked(usePathname).mockReturnValue(pathname);
  jest.mocked(useGlobalSearchParams).mockReturnValue(params);
  const gateway = createPushNotificationGatewayStub();
  const container = createTestDi({ pushNotification: gateway });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  await renderHook(() => useForegroundPushPresentation(), { wrapper });
  return { gateway };
}

describe('useForegroundPushPresentation', () => {
  it('그 콕 화면을 보고 있으면 받은 콕 알림을 배너 없이 알림 센터에만 남긴다', async () => {
    // Given
    const { gateway } = await setup({ pathname: '/nudges/5', params: { nudgeId: '5' } });

    // When
    const presentation = gateway.presentInForeground(NUDGE_PUSH);

    // Then
    expect(presentation).toBe('quiet');
  });

  it('다른 화면을 보고 있으면 배너로 알린다', async () => {
    // Given
    const { gateway } = await setup({ pathname: '/feed', params: {} });

    // When
    const presentation = gateway.presentInForeground(NUDGE_PUSH);

    // Then
    expect(presentation).toBe('banner');
  });

  it('계약에 맞지 않는 알림은 배너로 알린다', async () => {
    // Given
    const { gateway } = await setup({ pathname: '/notifications', params: {} });

    // When
    const presentation = gateway.presentInForeground({ data: { notificationId: 'broken' } });

    // Then
    expect(presentation).toBe('banner');
  });
});
