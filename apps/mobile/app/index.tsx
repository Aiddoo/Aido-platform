import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { Redirect } from 'expo-router';
import { match } from 'ts-pattern';

const Index = () => {
  const { status } = useAuth();

  return match(status)
    .with('loading', 'locked', () => <Redirect href="/loading" />)
    .with('authenticated', () => <Redirect href="/feed" />)
    .with('unauthenticated', () => <Redirect href="/login" />)
    .exhaustive();
};

export default Index;
