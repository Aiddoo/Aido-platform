import { useSocialAuth } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { match } from 'ts-pattern';

/** Android에서 OAuth 콜백이 deep link로 처리될 때 열어 둔 브라우저 세션이 URL을 받도록 세션을 끝낸다. iOS는 자동 처리되어 이 라우트가 실행되지 않는다 */
export default function OAuthCallbackScreen() {
  const status = useAuthStatus();
  const socialAuth = useSocialAuth();

  useEffect(() => {
    socialAuth.completeOAuthSession();
  }, [socialAuth]);

  // 판정 전과 잠긴 키체인은 미인증이 아니다. 첫 화면(Index)처럼 로그인 화면 대신 판정을 기다린다
  return match(status)
    .with('loading', 'locked', () => <Redirect href="/loading" />)
    .with('authenticated', () => <Redirect href="/feed" />)
    .with('unauthenticated', () => <Redirect href="/login" />)
    .exhaustive();
}
