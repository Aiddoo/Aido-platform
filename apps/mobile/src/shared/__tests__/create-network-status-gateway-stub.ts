import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';

/** 구독만 받고 상태 변화를 알리지 않는다 */
export const createNetworkStatusGatewayStub = (): jest.Mocked<NetworkStatusGateway> => ({
  subscribe: jest.fn().mockReturnValue(() => {}),
});
