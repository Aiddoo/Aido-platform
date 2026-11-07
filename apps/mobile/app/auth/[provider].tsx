import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

/**
 * OAuth 콜백 핸들러
 *
 * Android에서 OAuth 콜백이 deep link로 처리될 때 WebBrowser.openAuthSessionAsync()가
 * URL을 캡처할 수 있도록 maybeCompleteAuthSession()을 호출한다.
 * iOS에서는 자동으로 처리되므로 이 라우트가 실행되지 않는다.
 *
 * @see https://docs.expo.dev/guides/authentication/#expo-web-browser
 */
export default function OAuthCallbackScreen() {
  const status = useAuthStatus();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  if (status === 'authenticated') {
    return <Redirect href="/feed" />;
  }

  return <Redirect href="/login" />;
}
