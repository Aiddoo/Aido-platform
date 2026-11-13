import type { SessionExpiredReason } from '@src/core/observability/telemetry-event';

import { type LoginFailureReason } from '../domains/auth.error';
import { type OAuthProviderSlug } from '../domains/oauth.model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    auth_login: { method: 'email' | OAuthProviderSlug };
    /** 사용자가 직접 닫은 소셜 창은 세지 않는다. invalid_credentials는 이메일 로그인에서만 나온다 */
    auth_login_failed: { method: 'email' | OAuthProviderSlug; reason: LoginFailureReason };
    auth_signup: { method: 'email' | OAuthProviderSlug };
    /** 단계 이름은 가입 흐름(`SignUpStepContexts`)의 키와 같다. 뒤로 가서 다시 보면 또 센다 */
    auth_signup_step_viewed: {
      step: 'name' | 'email' | 'password' | 'passwordConfirm' | 'verification';
    };
    /** 가입 직후(sign_up)와 미인증 계정 로그인(login) 중 어디서 인증했는지 */
    auth_email_verified: { source: 'sign_up' | 'login' };
    auth_email_verification_resent: { source: 'sign_up' | 'login' };
    /** 단계 이름은 비밀번호 찾기 흐름의 키와 같다 */
    auth_password_reset_step_viewed: {
      step: 'email' | 'verificationCode' | 'newPassword' | 'newPasswordConfirm';
    };
    /** 인증 코드를 보냈다. 다시 보내기도 한 번으로 센다 */
    auth_password_reset_requested: undefined;
    auth_password_reset_completed: undefined;
    auth_password_changed: undefined;
    auth_logout: undefined;
    auth_social_linked: { provider: OAuthProviderSlug };
    auth_social_unlinked: { provider: OAuthProviderSlug };
    auth_account_deleted: undefined;
    /** 비자발적 로그아웃(토큰 만료·거부·재사용 감지). reason별 severity는 Sentry 쪽에서 판정. */
    session_expired: { reason: SessionExpiredReason };
  }
}
