import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';

import { mockMethod } from './mock-method';

export type NetworkStatusGatewayStub = jest.Mocked<NetworkStatusGateway> & {
  /** 연결 상태가 바뀐 것처럼 구독자에게 알린다 */
  emit(isOnline: boolean): void;
  /** 남은 구독 수. 정리됐는지 확인할 때 쓴다 */
  getListenerCount(): number;
};

/** 구독은 받고 상태 변화는 `emit`으로만 알린다 */
export function createNetworkStatusGatewayStub(): NetworkStatusGatewayStub {
  const listeners = new Set<(isOnline: boolean) => void>();

  return {
    subscribe: mockMethod<NetworkStatusGateway['subscribe']>((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    emit: (isOnline) => {
      for (const listener of Array.from(listeners)) {
        listener(isOnline);
      }
    },
    getListenerCount: () => listeners.size,
  };
}
