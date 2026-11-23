import {
  createAnalyticsStub,
  createErrorReporterStub,
  createNetworkStatusGatewayStub,
} from '@src/testing/core';
import { onlineManager } from '@tanstack/react-query';

import { connectOnlineManager } from './online-manager';

describe('connectOnlineManager', () => {
  let disconnect: () => void = () => {};

  afterEach(() => {
    disconnect();
  });

  it('기기 연결이 끊겼다가 돌아오면 React Query 온라인 상태가 따라 바뀐다', () => {
    // Given
    const network = createNetworkStatusGatewayStub();
    const errorReporter = createErrorReporterStub();
    disconnect = connectOnlineManager({
      networkStatus: network,
      errorReporter,
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
    const network = createNetworkStatusGatewayStub();
    const errorReporter = createErrorReporterStub();
    disconnect = connectOnlineManager({
      networkStatus: network,
      errorReporter,
      analytics: createAnalyticsStub(),
    });

    // When
    network.emit(false);
    network.emit(false);
    network.emit(true);
    network.emit(true);

    // Then
    expect(errorReporter.addBreadcrumb.mock.calls.map(([{ message }]) => message)).toEqual([
      'network_offline',
      'network_online',
    ]);
  });

  it('오프라인 구간마다 오프라인 배너 노출을 한 번만 센다', () => {
    // 연결된 기기
    // Given
    const network = createNetworkStatusGatewayStub();
    const analytics = createAnalyticsStub();
    disconnect = connectOnlineManager({
      networkStatus: network,
      errorReporter: createErrorReporterStub(),
      analytics,
    });

    // 두 번 끊겼다 돌아오고, 끊긴 동안 같은 상태가 반복된다
    // When
    network.emit(false);
    network.emit(false);
    network.emit(true);
    network.emit(false);
    network.emit(true);

    // 오프라인 구간 수만큼만 남는다
    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(2);
    expect(analytics.trackEvent).toHaveBeenCalledWith('offline_banner_shown', undefined);
  });

  it('연결을 해제하면 기기 상태 구독을 끝내고 온라인으로 되돌린다', () => {
    // Given
    const network = createNetworkStatusGatewayStub();
    const errorReporter = createErrorReporterStub();
    const disconnectNow = connectOnlineManager({
      networkStatus: network,
      errorReporter,
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
