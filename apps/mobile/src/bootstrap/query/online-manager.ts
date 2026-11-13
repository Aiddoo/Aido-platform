import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';
import { track } from '@src/shared/analytics/track';
import { onlineManager } from '@tanstack/react-query';

interface OnlineManagerPorts {
  networkStatus: NetworkStatusGateway;
  errorReporter: Pick<ErrorReporter, 'addBreadcrumb'>;
  analytics: Analytics;
}

/** 오프라인이면 쿼리·뮤테이션이 멈추고(networkMode 'online') 다시 연결되면 이어서 실행된다 */
export function connectOnlineManager({
  networkStatus,
  errorReporter,
  analytics,
}: OnlineManagerPorts) {
  onlineManager.setEventListener((setOnline) => networkStatus.subscribe(setOnline));

  // onlineManager는 값이 바뀔 때만 알리므로 전환마다 breadcrumb가 한 번씩 남는다.
  // 오프라인 배너는 오프라인인 동안 보이므로 오프라인 전환이 곧 배너가 뜬 오프라인 구간 하나다
  const unsubscribe = onlineManager.subscribe((isOnline) => {
    errorReporter.addBreadcrumb({
      category: 'network',
      level: isOnline ? 'info' : 'warning',
      message: isOnline ? 'network_online' : 'network_offline',
    });
    if (!isOnline) {
      track(analytics, 'offline_banner_shown');
    }
  });

  return () => {
    unsubscribe();
    onlineManager.setEventListener(() => undefined);
    onlineManager.setOnline(true);
  };
}
