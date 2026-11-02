import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

import { useAnalytics, useErrorReporter, useNetworkStatus } from './di-context';
import { connectOnlineManager } from './online-manager';

/** 앱 전체에서 한 번, 기기 연결 상태를 React Query에 연결한다 */
export function OnlineManagerProvider({ children }: PropsWithChildren) {
  const networkStatus = useNetworkStatus();
  const errorReporter = useErrorReporter();
  const analytics = useAnalytics();

  useEffect(
    () => connectOnlineManager({ networkStatus, errorReporter, analytics }),
    [networkStatus, errorReporter, analytics],
  );

  return children;
}
