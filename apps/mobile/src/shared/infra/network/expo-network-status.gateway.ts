import type { NetworkStatusGateway } from '@src/core/ports/network-status';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';

// 상태를 아직 모르면(undefined) 오프라인으로 단정하지 않는다
const isOnline = (state: NetworkState): boolean => state.isConnected !== false;

export const expoNetworkStatusGateway: NetworkStatusGateway = {
  subscribe: (listener) => {
    let hasEvent = false;
    let isSubscribed = true;
    const subscription = addNetworkStateListener((state) => {
      hasEvent = true;
      listener(isOnline(state));
    });

    getNetworkStateAsync()
      .then((state) => {
        // 구독을 끝낸 뒤(Fast Refresh·재연결) 늦게 온 첫 조회가 새 구독의 상태를 덮어쓰지 않게 한다
        if (isSubscribed && !hasEvent) {
          listener(isOnline(state));
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
      subscription.remove();
    };
  },
};
