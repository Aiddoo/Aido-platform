import { useSocialAuth } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';

/**
 * OAuth 콜백 핸들러
 *
 * Android에서 OAuth 콜백이 deep link로 처리될 때 열어 둔 브라우저 세션이 URL을 받도록 세션을 끝낸다.
 * iOS에서는 자동으로 처리되므로 이 라우트가 실행되지 않는다.
 *
 * @see https://docs.expo.dev/guides/authentication/#expo-web-browser
 */
export default function OAuthCallbackScreen() {
  const status = useAuthStatus();
  const socialAuthGateway = useSocialAuth();

  useEffect(() => {
    socialAuthGateway.completeOAuthSession();
  }, [socialAuthGateway]);

  if (status === 'authenticated') {
    return <Redirect href="/feed" />;
  }

  return <Redirect href="/login" />;
}
