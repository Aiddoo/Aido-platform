import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

/**
 * OAuth 콜백 핸들러
 *
 * Android에서 OAuth 콜백이 deep link로 처리될 때
 * WebBrowser.openAuthSessionAsync()가 URL을 캡처할 수 있도록
 * maybeCompleteAuthSession()을 호출합니다.
 *
 * 인증 상태에 따라 적절한 화면으로 직접 이동:
 * - authenticated: home 화면으로 즉시 전환
 * - 그 외: login 화면으로 이동
 *
 * iOS에서는 자동으로 처리되므로 이 라우트가 실행되지 않습니다.
 *
 * @see https://docs.expo.dev/guides/authentication/#expo-web-browser
 */
export default function OAuthCallbackScreen() {
  const { status } = useAuth();

  useEffect(() => {
    // Android에서 WebBrowser.openAuthSessionAsync()가 URL을 캡처하도록 처리
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // exchangeCode가 완료되면 status가 'authenticated'로 변경됨
  // 이를 감지하여 직접 home으로 이동 (중간 redirect 제거)
  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  // 아직 exchangeCode가 진행 중이거나 실패한 경우
  return <Redirect href="/login" />;
}
