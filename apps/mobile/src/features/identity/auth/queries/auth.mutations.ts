import {
  useAuthService,
  useHaptics,
  useLogOutDeviceService,
  useSessionCleanupService,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getUserFacingMessage } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { getOAuthProviderLabel } from '../constants/auth-provider-labels';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import {
  isEmailAlreadyRegisteredError,
  isEmailNotVerifiedError,
  isLoginCancelledError,
  isPasswordMismatchError,
  isVerificationAttemptsExceededError,
  isVerificationCodeExpiredError,
  isVerificationCodeInvalidError,
} from '../domains/auth.error';
import { toOAuthProvider, toOAuthProviderSlug } from '../domains/oauth.model';
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
} from '../schemas/auth.schema';
import type { OAuthProvider, OAuthProviderSlug } from '../schemas/oauth.schema';

// 사용자가 직접 닫은 소셜 인증 창은 실패 문구 없이 햅틱만 울린다
function useSocialLoginFailure(fallback = t('auth:toasts.loginFailed')) {
  const haptics = useHaptics();
  const toast = useAppToast();

  return (error: unknown) => {
    haptics.notify('error');
    if (isLoginCancelledError(error)) {
      return;
    }

    toast.error(getUserFacingMessage(error), { fallback });
  };
}

// 인증 폼은 오프라인에 스피너로 멈추지 않고 바로 실패해 입력값을 둔 채 안내한다
export function useEmailLoginMutationOptions() {
  const haptics = useHaptics();
  const push = useSingleTap(router.push);
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { signIn } = useAuthSession();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async ({ email, password }: { email: string; password: string }) =>
      unwrap(await authService.emailLogin(email, password)),
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
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.loginFailed') });
    },
  });
}

export function useExchangeCodeMutationOptions() {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { signIn } = useAuthSession();
  const toast = useAppToast();
  const showFailure = useSocialLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (request: ExchangeCodeInput & { provider: OAuthProviderSlug }) =>
      unwrap(await authService.exchangeCode(request)),
    onSuccess: (data, variables) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: variables.provider });
    },
    onError: showFailure,
  });
}

export function useOpenAppleLoginMutationOptions() {
  const authService = useAuthService();
  const { signIn } = useAuthSession();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const showFailure = useSocialLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await authService.openAppleLogin()),
    onSuccess: (data) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: 'apple' });
    },
    onError: showFailure,
  });
}

export function useOpenGoogleLoginMutationOptions() {
  const authService = useAuthService();
  const showFailure = useSocialLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await authService.openGoogleLogin()),
    onError: showFailure,
  });
}

export function useOpenKakaoLoginMutationOptions() {
  const authService = useAuthService();
  const showFailure = useSocialLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await authService.openKakaoLogin()),
    onError: showFailure,
  });
}

export function useOpenNaverLoginMutationOptions() {
  const authService = useAuthService();
  const showFailure = useSocialLoginFailure();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async () => unwrap(await authService.openNaverLogin()),
    onError: showFailure,
  });
}

export function useLogoutMutationOptions() {
  const logOutDeviceService = useLogOutDeviceService();
  const { trackEvent, clearUser } = useTrack();
  const { signOut } = useAuthSession();

  return mutationOptions({
    // 오프라인에서도 멈추지 않고 바로 이 기기의 세션을 끝낸다
    networkMode: 'always',
    // 세션 만료가 먼저 커밋되면 정리가 이 변경의 콜백을 지운다. 사용자가 나간 것으로 끝나도록 콜백에 두지 않는다.
    // 캐시 정리는 미인증 전환이 커밋된 뒤 부팅 훅이 수행한다.
    mutationFn: async () => {
      const outcome = await logOutDeviceService.logOut(onlineManager.isOnline());
      if (outcome === 'superseded') {
        return;
      }
      trackEvent('auth_logout');
      clearUser();
      signOut();
    },
  });
}

export function useDeleteAccountMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent, resetData } = useTrack();
  const toast = useAppToast();
  const { signOut } = useAuthSession();
  const queryClient = useQueryClient();
  const sessionCleanupService = useSessionCleanupService();

  return mutationOptions({
    networkMode: 'always',
    // 푸시 기기는 서버 탈퇴가 전 세션과 함께 푼다. 먼저 풀면 비밀번호 오류에도 알림이 끊긴다
    // 탈퇴가 성공한 뒤 기다리는 사이 세션 만료가 먼저 커밋되면 정리가 이 변경의 콜백을 지운다.
    // 지운 계정의 초안과 안내 기록이 남지 않도록 콜백에 두지 않는다.
    // 캐시 정리는 미인증 전환이 커밋된 뒤 부팅 훅이 수행한다.
    mutationFn: async (input: DeleteAccountInput) => {
      const accountId = getCachedMe(queryClient)?.id;
      unwrap(await authService.deleteAccount(input));
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
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.deleteAccountFailed') });
    },
  });
}

export function useRegisterMutationOptions() {
  const replace = useSingleTap(router.replace);
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: RegisterInput) => unwrap(await authService.register(input)),
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
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.registerFailed') });
    },
  });
}

export function useVerifyEmailMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const authService = useAuthService();
  const { signIn } = useAuthSession();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: VerifyEmailInput) => unwrap(await authService.verifyEmail(input)),
    onSuccess: () => {
      signIn();
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.codeInvalid') });
    },
  });
}

export function useResendVerificationMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResendVerificationInput) =>
      unwrap(await authService.resendVerification(input)),
    onSuccess: () => {
      toast.success(t('auth:toasts.codeResent'));
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.codeResendFailed') });
    },
  });
}

export function useForgotPasswordMutationOptions() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const authService = useAuthService();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ForgotPasswordInput) =>
      unwrap(await authService.forgotPassword(input)),
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.requestFailed') });
    },
  });
}

export function useResetPasswordMutationOptions() {
  const haptics = useHaptics();
  const replace = useSingleTap(router.replace);
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResetPasswordInput) => unwrap(await authService.resetPassword(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordResetDone'));
      replace('/(auth)/email-login');
    },
    onError: (error) => {
      const codeMessage = match(error)
        .when(isVerificationCodeInvalidError, () => t('auth:toasts.codeInvalid'))
        .when(isVerificationCodeExpiredError, () => t('auth:toasts.codeExpired'))
        .when(isVerificationAttemptsExceededError, () => t('auth:toasts.codeAttemptsExceeded'))
        .otherwise(() => null);
      if (codeMessage != null) {
        haptics.notify('error');
        toast.error(codeMessage);
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.passwordResetFailed') });
    },
  });
}

export function useChangePasswordMutationOptions() {
  const haptics = useHaptics();
  const goBack = useSingleTap(router.back);
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ChangePasswordInput) =>
      unwrap(await authService.changePassword(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordChanged'));
      goBack();
    },
    onError: (error) => {
      if (isPasswordMismatchError(error)) {
        haptics.notify('error');
        toast.error(t('auth:toasts.currentPasswordMismatch'));
        return;
      }

      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.passwordChangeFailed') });
    },
  });
}

export function useLinkAccountMutationOptions() {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useSocialLoginFailure(t('auth:toasts.linkFailed'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (provider: OAuthProviderSlug) =>
      unwrap(await authService.linkAccount(provider)),
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(
        t('auth:toasts.accountLinked', {
          provider: getOAuthProviderLabel(toOAuthProvider(provider)),
        }),
      );
      trackEvent('auth_social_linked', { provider });
    },
    onError: showFailure,
  });
}

export function useUnlinkAccountMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (provider: OAuthProvider) =>
      unwrap(await authService.unlinkAccount(provider)),
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(
        t('auth:toasts.accountUnlinked', { provider: getOAuthProviderLabel(provider) }),
      );
      trackEvent('auth_social_unlinked', {
        provider: toOAuthProviderSlug(provider),
      });
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), { fallback: t('auth:toasts.unlinkFailed') });
    },
  });
}
