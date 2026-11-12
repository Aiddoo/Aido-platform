import {
  useAuthApi,
  useHaptics,
  useLogOutDeviceService,
  useSessionCleanupService,
  useSignInService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { ensureMe, invalidateMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTrack } from '@src/shared/analytics';
import type { AppEventMap } from '@src/shared/analytics/event-map';
import { isConnectivityError } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { toOAuthProvider, toOAuthProviderSlug } from '../apis/oauth.mapper';
import { getOAuthProviderLabel } from '../constants/oauth-labels';
import {
  findLoginFailureReason,
  isEmailAlreadyRegisteredError,
  isEmailNotVerifiedError,
  isLoginCancelledError,
  isPasswordMismatchError,
} from '../domains/auth.error';
import { type OAuthProvider, type OAuthProviderSlug } from '../domains/oauth.model';
import { useAuthSession } from '../hooks/use-auth-session';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  ExchangeCodeInput,
  ForgotPasswordInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '../schemas/auth-request.schema';
import { invalidateLinkedAccounts } from './auth-cache';

type EmailVerificationSource = AppEventMap['auth_email_verified']['source'];

type VerifyEmailVariables = VerifyEmailInput & { source: EmailVerificationSource };

type ResendVerificationVariables = ResendVerificationInput & {
  source: EmailVerificationSource;
};

/** 서버나 공급자가 끝낸 로그인 실패만 센다. 사용자가 직접 닫은 소셜 창은 세지 않는다 */
function useTrackLoginFailure() {
  const { trackEvent } = useTrack();

  return (method: 'email' | OAuthProviderSlug, error: unknown) => {
    const reason = findLoginFailureReason(error, method);
    if (reason != null) {
      trackEvent('auth_login_failed', { method, reason });
    }
  };
}

// 인증 폼은 오프라인에 스피너로 멈추지 않고 바로 실패해 입력값을 둔 채 안내한다
export function useEmailLoginMutationOptions() {
  const haptics = useHaptics();
  const signInService = useSignInService();
  const { trackEvent } = useTrack();
  const trackLoginFailure = useTrackLoginFailure();
  const { signIn } = useAuthSession();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ email, password }: { email: string; password: string }) =>
      unwrap(await signInService.emailLogin({ email, password })),
    onSuccess: (data) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }
      trackEvent('auth_login', { method: 'email' });
    },
    // 미인증 계정은 폼이 인증 화면으로 보낸다
    onError: (error) => {
      trackLoginFailure('email', error);
      if (isEmailNotVerifiedError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.loginFailed',
        isHandledByFeature: isEmailNotVerifiedError,
      },
    },
  });
}

export function useExchangeCodeMutationOptions() {
  const signInService = useSignInService();
  const { trackEvent } = useTrack();
  const trackLoginFailure = useTrackLoginFailure();
  const { signIn } = useAuthSession();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ code }: ExchangeCodeInput & { provider: OAuthProviderSlug }) =>
      unwrap(await signInService.exchangeCode({ code })),
    onSuccess: (data, variables) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: variables.provider });
    },
    onError: (error, variables) => {
      trackLoginFailure(variables.provider, error);
      // 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.loginFailed',
        isHandledByFeature: isLoginCancelledError,
      },
    },
  });
}

export function useOpenAppleLoginMutationOptions() {
  const signInService = useSignInService();
  const { signIn } = useAuthSession();
  const { trackEvent } = useTrack();
  const trackLoginFailure = useTrackLoginFailure();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openAppleLogin()),
    onSuccess: (data) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: 'apple' });
    },
    onError: (error) => {
      trackLoginFailure('apple', error);
      // 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.loginFailed',
        isHandledByFeature: isLoginCancelledError,
      },
    },
  });
}

export function useOpenGoogleLoginMutationOptions() {
  const signInService = useSignInService();
  const haptics = useHaptics();
  const trackLoginFailure = useTrackLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openGoogleLogin()),
    onError: (error) => {
      trackLoginFailure('google', error);
      // 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.loginFailed',
        isHandledByFeature: isLoginCancelledError,
      },
    },
  });
}

export function useOpenKakaoLoginMutationOptions() {
  const signInService = useSignInService();
  const haptics = useHaptics();
  const trackLoginFailure = useTrackLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openKakaoLogin()),
    onError: (error) => {
      trackLoginFailure('kakao', error);
      // 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.loginFailed',
        isHandledByFeature: isLoginCancelledError,
      },
    },
  });
}

export function useOpenNaverLoginMutationOptions() {
  const signInService = useSignInService();
  const haptics = useHaptics();
  const trackLoginFailure = useTrackLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openNaverLogin()),
    onError: (error) => {
      trackLoginFailure('naver', error);
      // 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.loginFailed',
        isHandledByFeature: isLoginCancelledError,
      },
    },
  });
}

export function useLogoutMutationOptions() {
  const logOutDeviceService = useLogOutDeviceService();
  const { trackEvent, clearUser } = useTrack();
  const { signOut } = useAuthSession();

  return mutationOptions({
    // 오프라인에서도 멈추지 않고 바로 이 기기의 세션을 끝낸다
    networkMode: 'always',
    // 세션 만료가 먼저 커밋되면 정리가 콜백을 지우므로 나간 것으로 끝나게 콜백에 두지 않는다(캐시는 부팅 훅이 비운다)
    mutationFn: async () => {
      const outcome = await logOutDeviceService.logOut({ isOnline: onlineManager.isOnline() });
      if (outcome === 'superseded') {
        return;
      }
      trackEvent('auth_logout');
      clearUser();
      signOut();
    },
    meta: { errorFeedback: false },
  });
}

export function useDeleteAccountMutationOptions() {
  const haptics = useHaptics();
  const signInService = useSignInService();
  const { trackEvent, resetData } = useTrack();
  const toast = useAppToast();
  const { signOut } = useAuthSession();
  const queryClient = useQueryClient();
  const meQueryOptions = useGetMeQueryOptions();
  const sessionCleanupService = useSessionCleanupService();

  // 탈퇴 뒤에는 서버가 내 정보를 주지 않아 요청 전에 받는다. 오프라인에 멈추거나 재시도로 늦추지 않고, 받지 못해도 탈퇴는 이어 간다
  const findAccountId = async () => {
    try {
      const me = await ensureMe(queryClient, {
        ...meQueryOptions,
        retry: false,
        networkMode: 'always',
      });
      return me.id;
    } catch {
      return null;
    }
  };

  return mutationOptions({
    networkMode: 'always',
    // 푸시 기기는 서버 탈퇴가 함께 푼다. 먼저 풀면 비밀번호 오류에도 알림이 끊긴다
    // 세션 만료가 먼저 커밋되면 정리가 콜백을 지워 초안·안내 기록이 남으므로 콜백에 두지 않는다
    mutationFn: async (input: DeleteAccountInput) => {
      sessionCleanupService.beforeAccountDeletion(await findAccountId());
      try {
        unwrap(await signInService.deleteAccount(input));
      } catch (error) {
        // 응답을 받지 못했으면 서버가 지웠을 수 있어 이어지는 세션 종료를 로그아웃처럼 정리한다
        if (!isConnectivityError(error)) {
          sessionCleanupService.afterAccountDeletionRejected();
        }
        throw error;
      }
      haptics.notify('success');
      toast.success(t('auth:toasts.accountDeleted'));
      trackEvent('auth_account_deleted');
      resetData();
      signOut();
    },
    // 비밀번호가 틀리면 폼이 그 칸에 보인다
    onError: (error) => {
      if (isPasswordMismatchError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.deleteAccountFailed',
        isHandledByFeature: isPasswordMismatchError,
      },
    },
  });
}

export function useRegisterMutationOptions() {
  const replace = useSingleTap(router.replace);
  const haptics = useHaptics();
  const authApi = useAuthApi();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: RegisterInput) => unwrap(await authApi.register(input)),
    onSuccess: ({ isEmailSent }) => {
      trackEvent('auth_signup', { method: 'email' });
      if (!isEmailSent) {
        toast.warning(t('auth:toasts.verificationEmailNotSent'));
      }
    },
    onError: (error) => {
      if (isEmailAlreadyRegisteredError(error)) {
        haptics.notify('error');
        toast.error(t('auth:toasts.alreadyRegistered'), {
          action: {
            label: t('auth:toasts.goToLogin'),
            onPress: () => {
              replace('/(auth)/email-login');
            },
          },
        });
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.registerFailed',
        isHandledByFeature: isEmailAlreadyRegisteredError,
      },
    },
  });
}

export function useVerifyEmailMutationOptions() {
  const signInService = useSignInService();
  const { trackEvent } = useTrack();
  const { signIn } = useAuthSession();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ email, code }: VerifyEmailVariables) =>
      unwrap(await signInService.verifyEmail({ email, code })),
    onSuccess: (_data, { source }) => {
      trackEvent('auth_email_verified', { source });
      signIn();
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.requestFailed' } },
  });
}

export function useResendVerificationMutationOptions() {
  const authApi = useAuthApi();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ email }: ResendVerificationVariables) =>
      unwrap(await authApi.resendVerification({ email })),
    onSuccess: (_data, { source }) => {
      trackEvent('auth_email_verification_resent', { source });
      toast.success(t('auth:toasts.codeResent'));
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.codeResendFailed' } },
  });
}

export function useForgotPasswordMutationOptions() {
  const authApi = useAuthApi();
  const { trackEvent } = useTrack();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ForgotPasswordInput) => unwrap(await authApi.forgotPassword(input)),
    onSuccess: () => {
      trackEvent('auth_password_reset_requested');
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.requestFailed' } },
  });
}

// 끝난 뒤 로그인 화면으로 가는 것과 코드가 거절되면 코드 단계로 돌아가는 것은 폼이 한다
export function useResetPasswordMutationOptions() {
  const haptics = useHaptics();
  const authApi = useAuthApi();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResetPasswordInput) => unwrap(await authApi.resetPassword(input)),
    onSuccess: () => {
      trackEvent('auth_password_reset_completed');
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordResetDone'));
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.passwordResetFailed' } },
  });
}

// 끝난 뒤 앞 화면으로 돌아가는 것은 폼이 한다
export function useChangePasswordMutationOptions() {
  const haptics = useHaptics();
  const authApi = useAuthApi();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ChangePasswordInput) => unwrap(await authApi.changePassword(input)),
    onSuccess: () => {
      trackEvent('auth_password_changed');
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordChanged'));
    },
    // 현재 비밀번호가 틀리면 폼이 그 칸으로 돌아가 보인다
    onError: (error) => {
      if (isPasswordMismatchError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.passwordChangeFailed',
        isHandledByFeature: isPasswordMismatchError,
      },
    },
  });
}

export function useLinkAccountMutationOptions() {
  const signInService = useSignInService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (provider: OAuthProviderSlug) =>
      unwrap(await signInService.linkAccount(provider)),
    onSuccess: async (_data, provider) => {
      toast.success(
        t('auth:toasts.accountLinked', {
          provider: getOAuthProviderLabel(toOAuthProvider(provider)),
        }),
      );
      trackEvent('auth_social_linked', { provider });
      // 화면에 머무는 행이라 새 연결 상태를 받을 때까지 버튼을 꺼 둔다. 옛 버튼을 다시 눌러 요청이 또 가지 않게 한다
      await Promise.all([invalidateLinkedAccounts(queryClient), invalidateMe(queryClient)]);
    },
    onError: (error) => {
      // 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.linkFailed',
        isHandledByFeature: isLoginCancelledError,
      },
    },
  });
}

export function useUnlinkAccountMutationOptions() {
  const authApi = useAuthApi();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (provider: OAuthProvider) => unwrap(await authApi.unlinkAccount(provider)),
    onSuccess: async (_data, provider) => {
      toast.success(
        t('auth:toasts.accountUnlinked', { provider: getOAuthProviderLabel(provider) }),
      );
      trackEvent('auth_social_unlinked', {
        provider: toOAuthProviderSlug(provider),
      });
      // 화면에 머무는 행이라 새 연결 상태를 받을 때까지 버튼을 꺼 둔다. 옛 버튼을 다시 눌러 요청이 또 가지 않게 한다
      await Promise.all([invalidateLinkedAccounts(queryClient), invalidateMe(queryClient)]);
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.unlinkFailed' } },
  });
}
