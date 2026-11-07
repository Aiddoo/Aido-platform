import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useNotificationEntry } from '@src/features/notification/hooks/use-notification-entry';
import { useIsRestoring } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { match } from 'ts-pattern';

function Index() {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const entry = useNotificationEntry();

  if (isRestoring || entry.isResolving) {
    return <Redirect href="/loading" />;
  }

  return match(status)
    .with('loading', 'locked', () => <Redirect href="/loading" />)
    .with('authenticated', () => (
      <Redirect href={entry.href ?? '/feed'} withAnchor={entry.href != null} />
    ))
    .with('unauthenticated', () => <Redirect href="/login" />)
    .exhaustive();
}

export default Index;
