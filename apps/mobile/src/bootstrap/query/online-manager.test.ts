import type { Breadcrumb } from '@src/core/observability/breadcrumb';
import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';
import { createAnalyticsStub } from '@src/testing/core';
import { onlineManager } from '@tanstack/react-query';

import { connectOnlineManager } from './online-manager';

const createStubNetworkStatus = () => {
  let emit: (isOnline: boolean) => void = () => {};
  const gateway: NetworkStatusGateway = {
    subscribe: (listener) => {
      emit = listener;
      return () => {
        emit = () => {};
      };
    },
  };
  return { gateway, emit: (isOnline: boolean) => emit(isOnline) };
};

const createBreadcrumbRecorder = () => {
  const breadcrumbs: Breadcrumb[] = [];
  return { breadcrumbs, addBreadcrumb: (breadcrumb: Breadcrumb) => breadcrumbs.push(breadcrumb) };
};

describe('connectOnlineManager', () => {
  let disconnect: () => void = () => {};

  afterEach(() => {
    disconnect();
  });

  it('기기 연결이 끊겼다가 돌아오면 React Query 온라인 상태가 따라 바뀐다', () => {
    // Given
    const network = createStubNetworkStatus();
    const recorder = createBreadcrumbRecorder();
    disconnect = connectOnlineManager({
      networkStatus: network.gateway,
      errorReporter: recorder,
      analytics: createAnalyticsStub(),
    });

    // When
    network.emit(false);
    const offline = onlineManager.isOnline();
    network.emit(true);

    // Then
    expect(offline).toBe(false);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('같은 상태가 반복돼도 전환마다 breadcrumb를 한 번만 남긴다', () => {
    // Given
    const network = createStubNetworkStatus();
    const recorder = createBreadcrumbRecorder();
    disconnect = connectOnlineManager({
      networkStatus: network.gateway,
      errorReporter: recorder,
      analytics: createAnalyticsStub(),
    });

    // When
    network.emit(false);
    network.emit(false);
    network.emit(true);
    network.emit(true);

    // Then
    expect(recorder.breadcrumbs.map(({ message }) => message)).toEqual([
      'network_offline',
      'network_online',
    ]);
  });

  it('오프라인 구간마다 오프라인 배너 노출을 한 번만 센다', () => {
    // Given 연결된 기기
    const network = createStubNetworkStatus();
    const analytics = createAnalyticsStub();
    disconnect = connectOnlineManager({
      networkStatus: network.gateway,
      errorReporter: createBreadcrumbRecorder(),
      analytics,
    });

    // When 두 번 끊겼다 돌아오고, 끊긴 동안 같은 상태가 반복된다
    network.emit(false);
    network.emit(false);
    network.emit(true);
    network.emit(false);
    network.emit(true);

    // Then 오프라인 구간 수만큼만 남는다
    expect(analytics.trackEvent).toHaveBeenCalledTimes(2);
    expect(analytics.trackEvent).toHaveBeenCalledWith('offline_banner_shown', undefined);
  });

  it('연결을 해제하면 기기 상태 구독을 끝내고 온라인으로 되돌린다', () => {
    // Given
    const network = createStubNetworkStatus();
    const recorder = createBreadcrumbRecorder();
    const disconnectNow = connectOnlineManager({
      networkStatus: network.gateway,
      errorReporter: recorder,
      analytics: createAnalyticsStub(),
    });
    network.emit(false);

    // When
    disconnectNow();
    network.emit(false);

    // Then
    expect(onlineManager.isOnline()).toBe(true);
  });
});
