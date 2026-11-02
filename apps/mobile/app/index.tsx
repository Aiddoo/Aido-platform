import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useIsRestoring } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { match } from 'ts-pattern';

function Index() {
  const { status } = useAuth();
  const isRestoring = useIsRestoring();

  if (isRestoring) {
    return <Redirect href="/loading" />;
  }

  return match(status)
    .with('loading', 'locked', () => <Redirect href="/loading" />)
    .with('authenticated', () => <Redirect href="/feed" />)
    .with('unauthenticated', () => <Redirect href="/login" />)
    .exhaustive();
}

export default Index;
