import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

import { connectOnlineManager } from '../query/online-manager';
import { useAnalytics, useErrorReporter, useNetworkStatus } from './di-context';

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
