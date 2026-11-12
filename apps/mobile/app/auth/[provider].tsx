import { useSocialAuth } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';

/** Android에서 OAuth 콜백이 deep link로 처리될 때 열어 둔 브라우저 세션이 URL을 받도록 세션을 끝낸다. iOS는 자동 처리되어 이 라우트가 실행되지 않는다 */
export default function OAuthCallbackScreen() {
  const status = useAuthStatus();
  const socialAuth = useSocialAuth();

  useEffect(() => {
    socialAuth.completeOAuthSession();
  }, [socialAuth]);

  if (status === 'authenticated') {
    return <Redirect href="/feed" />;
  }

  return <Redirect href="/login" />;
}
