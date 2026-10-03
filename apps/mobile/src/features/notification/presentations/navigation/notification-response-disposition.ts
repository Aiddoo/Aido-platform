export type NotificationAuthStatus = 'loading' | 'locked' | 'authenticated' | 'unauthenticated';

export type NotificationResponseDisposition =
  | { status: 'process' }
  | {
      status: 'defer';
      reason: 'auth-resolving' | 'authentication-required' | 'navigation-not-ready';
    };

export function getNotificationResponseDisposition({
  authStatus,
  actionIdentifier,
  isNavigationReady = true,
}: {
  authStatus: NotificationAuthStatus;
  actionIdentifier: string;
  isNavigationReady?: boolean;
}): NotificationResponseDisposition {
  if (actionIdentifier === 'MARKETING_OPT_OUT') return { status: 'process' };
  if (authStatus === 'loading' || authStatus === 'locked')
    return { status: 'defer', reason: 'auth-resolving' };
  if (authStatus === 'unauthenticated')
    return { status: 'defer', reason: 'authentication-required' };
  if (!isNavigationReady) return { status: 'defer', reason: 'navigation-not-ready' };
  return { status: 'process' };
}
