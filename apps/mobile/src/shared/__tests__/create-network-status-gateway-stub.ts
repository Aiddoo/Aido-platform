import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';

import { mockMethod } from './mock-method';

/** 구독만 받고 상태 변화를 알리지 않는다 */
export function createNetworkStatusGatewayStub(): jest.Mocked<NetworkStatusGateway> {
  return {
    subscribe: mockMethod<NetworkStatusGateway['subscribe']>(() => () => {}),
  };
}
