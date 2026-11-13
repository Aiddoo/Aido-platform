import { useCloseOAuthCallback } from '@src/features/identity/auth/hooks/use-close-oauth-callback';

/** Android에서 OAuth 콜백이 deep link로 처리될 때만 열린다. iOS는 브라우저 세션이 URL을 받아 이 라우트가 실행되지 않는다 */
export default function OAuthCallbackScreen() {
  useCloseOAuthCallback();

  return null;
}
