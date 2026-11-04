import type { NetworkStatusGateway } from '@src/core/ports/network-status';
import { errorMessageOf } from '@src/shared/errors';
import { logger } from '@src/shared/infra/logger/global-logger';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';

import { NETWORK_STATUS_LOG_EVENT } from './network-status-log-events';

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
      .catch((error: unknown) => {
        logger.warn(NETWORK_STATUS_LOG_EVENT.INITIAL_READ_FAILED, { error: errorMessageOf(error) });
      });

    return () => {
      isSubscribed = false;
      subscription.remove();
    };
  },
};
