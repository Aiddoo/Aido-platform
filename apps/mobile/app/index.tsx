import { clearColdStartPath, findColdStartPath } from '@src/bootstrap/navigation/cold-start-link';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { usePushNotificationEntry } from '@src/features/notification/hooks/use-push-notification-entry';
import { useIsRestoring } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { match } from 'ts-pattern';

function Index() {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const entry = usePushNotificationEntry();
  const isReady = !isRestoring && !entry.isResolving && status === 'authenticated';
  // 지운 뒤 다시 그려져도 같은 곳으로 보내도록 처음 값을 묶어 둔다
  const [coldStartPath] = useState(findColdStartPath);
  const href = entry.href ?? coldStartPath;

  useEffect(() => {
    if (isReady) {
      clearColdStartPath();
    }
  }, [isReady]);

  if (isRestoring || entry.isResolving) {
    return <Redirect href="/loading" />;
  }

  return match(status)
    .with('loading', 'locked', () => <Redirect href="/loading" />)
    .with('authenticated', () => <Redirect href={href ?? '/feed'} withAnchor={href != null} />)
    .with('unauthenticated', () => <Redirect href="/login" />)
    .exhaustive();
}

export default Index;
