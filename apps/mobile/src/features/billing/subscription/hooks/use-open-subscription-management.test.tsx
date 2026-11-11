import { createExternalLinkGatewayStub } from '@src/testing/ports/external-link-gateway.stub';
import { createLoggerStub } from '@src/testing/ports/logger.stub';
import { createPurchasesGatewayStub } from '@src/testing/ports/purchases-gateway.stub';
import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import {
  APP_STORE_SUBSCRIPTIONS_URL,
  PLAY_STORE_SUBSCRIPTIONS_URL,
} from '../constants/subscription.constants';
import { SubscriptionService } from '../services/subscription.service';
import { useOpenSubscriptionManagement } from './use-open-subscription-management';

async function openManagement(managementUrl: string | null) {
  const purchases = createPurchasesGatewayStub();
  purchases.getStatus.mockResolvedValue({ activeEntitlements: [], managementUrl });
  const externalLink = createExternalLinkGatewayStub();
  const subscriptionService = new SubscriptionService(
    { isConfigured: () => true },
    purchases,
    createLoggerStub(),
  );
  const { result } = await renderScreenHook(() => useOpenSubscriptionManagement(), {
    di: { subscriptionService, externalLink },
  });

  await act(async () => {
    await result.current();
  });
  return externalLink;
}

describe('useOpenSubscriptionManagement', () => {
  it('스토어가 구독 관리 주소를 주면 그 주소를 연다', async () => {
    // Given
    const managementUrl = 'https://apps.apple.com/account/subscriptions?id=1';

    // When
    const externalLink = await openManagement(managementUrl);

    // Then
    expect(externalLink.open).toHaveBeenCalledWith(managementUrl);
  });

  it('스토어가 주소를 주지 않으면 플랫폼 구독 목록을 연다', async () => {
    // Given
    const fallbackUrl =
      process.env.EXPO_OS === 'android'
        ? PLAY_STORE_SUBSCRIPTIONS_URL
        : APP_STORE_SUBSCRIPTIONS_URL;

    // When
    const externalLink = await openManagement(null);

    // Then
    expect(externalLink.open).toHaveBeenCalledWith(fallbackUrl);
  });
});
