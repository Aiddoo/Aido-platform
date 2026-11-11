import {
  useAuthApi,
  useHaptics,
  useLogOutDeviceService,
  useSessionCleanupService,
  useSignInService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { getOAuthProviderLabel } from '../constants/oauth-labels';
import {
  isEmailAlreadyRegisteredError,
  isEmailNotVerifiedError,
  isLoginCancelledError,
  isPasswordMismatchError,
  isVerificationAttemptsExceededError,
  isVerificationCodeExpiredError,
  isVerificationCodeInvalidError,
} from '../domains/auth.error';
import { type OAuthProvider, type OAuthProviderSlug } from '../domains/oauth.model';
import { OAuthPolicy } from '../domains/oauth.model';
import { useAuthSession } from '../hooks/use-auth-session';
import {
  type ChangePasswordInput,
  type DeleteAccountInput,
  type ExchangeCodeInput,
  type ForgotPasswordInput,
  type RegisterInput,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from '../schemas/auth-request.schema';
import { AUTH_QUERY_KEYS } from './auth-query-keys';

/** 인증 코드가 틀렸거나 만료됐거나 시도를 다 썼다. 코드마다 다른 문구로 알린다 */
function getVerificationCodeMessage(error: unknown) {
  return match(error)
    .when(isVerificationCodeInvalidError, () => t('auth:toasts.codeInvalid'))
    .when(isVerificationCodeExpiredError, () => t('auth:toasts.codeExpired'))
    .when(isVerificationAttemptsExceededError, () => t('auth:toasts.codeAttemptsExceeded'))
    .otherwise(() => null);
}

function isVerificationCodeRejection(error: unknown) {
  return getVerificationCodeMessage(error) != null;
}

// 인증 폼은 오프라인에 스피너로 멈추지 않고 바로 실패해 입력값을 둔 채 안내한다
export function useEmailLoginMutationOptions() {
  const haptics = useHaptics();
  const push = useSingleTap(router.push);
  const signInService = useSignInService();
  const { trackEvent } = useTrack();
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
    onError: (error, variables) => {
      if (isEmailNotVerifiedError(error)) {
        haptics.notify('error');
        push({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
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
    onError: (error) => {
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

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openGoogleLogin()),
    onError: (error) => {
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

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openKakaoLogin()),
    onError: (error) => {
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

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await signInService.openNaverLogin()),
    onError: (error) => {
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
  const sessionCleanupService = useSessionCleanupService();

  return mutationOptions({
    networkMode: 'always',
    // 푸시 기기는 서버 탈퇴가 함께 푼다. 먼저 풀면 비밀번호 오류에도 알림이 끊긴다
    // 세션 만료가 먼저 커밋되면 정리가 콜백을 지워 초안·안내 기록이 남으므로 콜백에 두지 않는다
    mutationFn: async (input: DeleteAccountInput) => {
      const accountId = getCachedMe(queryClient)?.id;
      unwrap(await signInService.deleteAccount(input));
      haptics.notify('success');
      toast.success(t('auth:toasts.accountDeleted'));
      trackEvent('auth_account_deleted');
      resetData();
      if (accountId != null) {
        sessionCleanupService.afterAccountDeleted(accountId);
      }
      signOut();
    },
    onError: (error) => {
      if (isPasswordMismatchError(error)) {
        haptics.notify('error');
        toast.error(t('auth:toasts.passwordMismatch'));
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
  const { signIn } = useAuthSession();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: VerifyEmailInput) => unwrap(await signInService.verifyEmail(input)),
    onSuccess: () => {
      signIn();
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.codeInvalid' } },
  });
}

export function useResendVerificationMutationOptions() {
  const authApi = useAuthApi();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResendVerificationInput) =>
      unwrap(await authApi.resendVerification(input)),
    onSuccess: () => {
      toast.success(t('auth:toasts.codeResent'));
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.codeResendFailed' } },
  });
}

export function useForgotPasswordMutationOptions() {
  const authApi = useAuthApi();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ForgotPasswordInput) => unwrap(await authApi.forgotPassword(input)),
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.requestFailed' } },
  });
}

export function useResetPasswordMutationOptions() {
  const haptics = useHaptics();
  const replace = useSingleTap(router.replace);
  const authApi = useAuthApi();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResetPasswordInput) => unwrap(await authApi.resetPassword(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordResetDone'));
      replace('/(auth)/email-login');
    },
    onError: (error) => {
      const codeMessage = getVerificationCodeMessage(error);
      if (codeMessage != null) {
        haptics.notify('error');
        toast.error(codeMessage);
      }
    },
    meta: {
      errorFeedback: {
        feature: 'auth',
        fallbackKey: 'auth:toasts.passwordResetFailed',
        isHandledByFeature: isVerificationCodeRejection,
      },
    },
  });
}

export function useChangePasswordMutationOptions() {
  const haptics = useHaptics();
  const goBack = useSingleTap(router.back);
  const authApi = useAuthApi();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ChangePasswordInput) => unwrap(await authApi.changePassword(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordChanged'));
      goBack();
    },
    onError: (error) => {
      if (isPasswordMismatchError(error)) {
        haptics.notify('error');
        toast.error(t('auth:toasts.currentPasswordMismatch'));
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
          provider: getOAuthProviderLabel(OAuthPolicy.toOAuthProvider(provider)),
        }),
      );
      trackEvent('auth_social_linked', { provider });
      // 화면에 머무는 행이라 새 연결 상태를 받을 때까지 버튼을 꺼 둔다. 옛 버튼을 다시 눌러 요청이 또 가지 않게 한다
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
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
        provider: OAuthPolicy.toOAuthProviderSlug(provider),
      });
      // 화면에 머무는 행이라 새 연결 상태를 받을 때까지 버튼을 꺼 둔다. 옛 버튼을 다시 눌러 요청이 또 가지 않게 한다
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
    },
    meta: { errorFeedback: { feature: 'auth', fallbackKey: 'auth:toasts.unlinkFailed' } },
  });
}
