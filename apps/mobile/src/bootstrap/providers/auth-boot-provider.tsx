import {
  useWidgetSnapshotSync,
  type WidgetSyncAuthState,
} from '@src/features/device/widget/hooks/use-widget-snapshot-sync';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { usePendingRevocationFlush } from '@src/features/identity/auth/hooks/use-pending-revocation-flush';
import type { PropsWithChildren } from 'react';
import { match } from 'ts-pattern';

import { useAuthBoot } from '../hooks/use-auth-boot';

/** 정리가 위젯 쓰기보다 뒤에 돌도록 `useAuthBoot`를 마지막에 부른다 */
export function AuthBootProvider({ children }: PropsWithChildren) {
  const status = useAuthStatus();
  const widgetSyncAuthState = match(status)
    .returnType<WidgetSyncAuthState>()
    .with('authenticated', 'unauthenticated', (resolved) => resolved)
    .with('loading', 'locked', () => 'resolving')
    .exhaustive();

  usePendingRevocationFlush();
  useWidgetSnapshotSync(widgetSyncAuthState);
  useAuthBoot();

  return children;
}
