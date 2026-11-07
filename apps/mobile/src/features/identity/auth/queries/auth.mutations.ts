import { ErrorCode } from '@aido/api/errors';
import {
  useAnalytics,
  useAuthService,
  useHaptics,
  useLogger,
  usePushDeviceService,
  useSessionCleanupService,
  useSessionRevocationService,
  useTokenStore,
} from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { mutationOptions, onlineManager, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { match } from 'ts-pattern';

import { getOAuthProviderLabel } from '../constants/auth-provider-labels';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import { isLoginCancelledError } from '../domains/auth.error';
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
import { logOutDevice } from '../utils/log-out-device';

// 인증 폼은 오프라인에 스피너로 멈추지 않고 바로 실패해 입력값을 둔 채 안내한다
export function useEmailLoginMutationOptions() {
  const haptics = useHaptics();
  const push = useSingleTap(router.push);
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { signIn } = useAuthSession();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.loginFailed'));

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
      if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503)) {
        haptics.notify('error');
        push({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
        return;
      }

      showFailure(error);
    },
  });
}

export function useExchangeCodeMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { signIn } = useAuthSession();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (request: ExchangeCodeInput & { provider: OAuthProviderSlug }) =>
      unwrap(await authService.exchangeCode(request)),
    onSuccess: (data, variables) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: variables.provider });
    },
    onError: () => {
      haptics.notify('error');
    },
  });
}

export function useOpenAppleLoginMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { signIn } = useAuthSession();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async () => unwrap(await authService.openAppleLogin()),
    onSuccess: (data) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: 'apple' });
    },
    onError: () => {
      haptics.notify('error');
    },
  });
}

export function useOpenGoogleLoginMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => unwrap(await authService.openGoogleLogin()),
    onError: () => {
      haptics.notify('error');
    },
  });
}

export function useOpenKakaoLoginMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => unwrap(await authService.openKakaoLogin()),
    onError: () => {
      haptics.notify('error');
    },
  });
}

export function useOpenNaverLoginMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => unwrap(await authService.openNaverLogin()),
    onError: () => {
      haptics.notify('error');
    },
  });
}

export function useLogoutMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const pushDeviceService = usePushDeviceService();
  const tokenStore = useTokenStore();
  const sessionRevocationService = useSessionRevocationService();
  const logger = useLogger();
  const { signOut } = useAuthSession();

  return mutationOptions({
    // 오프라인에서도 멈추지 않고 바로 이 기기의 세션을 끝낸다
    networkMode: 'always',
    mutationFn: () =>
      logOutDevice({
        isOnline: onlineManager.isOnline(),
        authService,
        pushDeviceService,
        tokenStore,
        sessionRevocationService,
        logger,
      }),
    onError: () => {
      haptics.notify('error');
    },
    // 캐시 정리는 미인증 전환이 커밋된 뒤 부팅 훅이 수행한다.
    onSettled: () => {
      trackEvent('auth_logout');
      analytics.setUserId(null);
      signOut();
    },
  });
}

export function useDeleteAccountMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const { signOut } = useAuthSession();
  const queryClient = useQueryClient();
  const sessionCleanupService = useSessionCleanupService();
  const showFailure = useMutationFailure(t('auth:toasts.deleteAccountFailed'));

  return mutationOptions({
    networkMode: 'always',
    // 푸시 기기는 서버 탈퇴가 전 세션과 함께 푼다. 먼저 풀면 비밀번호 오류에도 알림이 끊긴다
    mutationFn: async (input: DeleteAccountInput) => unwrap(await authService.deleteAccount(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.accountDeleted'));
      trackEvent('auth_account_deleted');
      analytics.resetData();
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        sessionCleanupService.afterAccountDeleted(accountId);
      }
    },
    onError: (error) => {
      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        haptics.notify('error');
        toast.error(t('auth:toasts.passwordMismatch'));
        return;
      }

      showFailure(error);
    },
    // 캐시 정리는 미인증 전환이 커밋된 뒤 부팅 훅이 수행한다.
    onSettled: (_data, error) => {
      if (!error) {
        signOut();
      }
    },
  });
}

export function useRegisterMutationOptions() {
  const replace = useSingleTap(router.replace);
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.registerFailed'));

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
      if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0501)) {
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

      showFailure(error);
    },
  });
}

export function useVerifyEmailMutationOptions() {
  const authService = useAuthService();
  const { signIn } = useAuthSession();
  const showFailure = useMutationFailure(t('auth:toasts.codeInvalid'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: VerifyEmailInput) => unwrap(await authService.verifyEmail(input)),
    onSuccess: () => {
      signIn();
    },
    onError: (error) => showFailure(error),
  });
}

export function useResendVerificationMutationOptions() {
  const authService = useAuthService();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.codeResendFailed'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResendVerificationInput) =>
      unwrap(await authService.resendVerification(input)),
    onSuccess: () => {
      toast.success(t('auth:toasts.codeResent'));
    },
    onError: (error) => showFailure(error),
  });
}

export function useForgotPasswordMutationOptions() {
  const authService = useAuthService();
  const showFailure = useMutationFailure(t('auth:toasts.requestFailed'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ForgotPasswordInput) =>
      unwrap(await authService.forgotPassword(input)),
    onError: (error) => showFailure(error),
  });
}

export function useResetPasswordMutationOptions() {
  const haptics = useHaptics();
  const replace = useSingleTap(router.replace);
  const authService = useAuthService();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.passwordResetFailed'));

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (input: ResetPasswordInput) => unwrap(await authService.resetPassword(input)),
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordResetDone'));
      replace('/(auth)/email-login');
    },
    onError: (error) => {
      const codeMessage = match(isApiError(error) ? error.code : null)
        .with(ErrorCode.VERIFY_0751, () => t('auth:toasts.codeInvalid'))
        .with(ErrorCode.VERIFY_0752, () => t('auth:toasts.codeExpired'))
        .with(ErrorCode.VERIFY_0754, () => t('auth:toasts.codeAttemptsExceeded'))
        .otherwise(() => null);
      if (codeMessage != null) {
        haptics.notify('error');
        toast.error(codeMessage);
        return;
      }

      showFailure(error);
    },
  });
}

export function useChangePasswordMutationOptions() {
  const haptics = useHaptics();
  const goBack = useSingleTap(router.back);
  const authService = useAuthService();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.passwordChangeFailed'));

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
      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        haptics.notify('error');
        toast.error(t('auth:toasts.currentPasswordMismatch'));
        return;
      }

      showFailure(error);
    },
  });
}

export function useLinkAccountMutationOptions() {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.linkFailed'));

  return mutationOptions({
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
    onError: (error) => {
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
        return;
      }

      showFailure(error);
    },
  });
}

export function useUnlinkAccountMutationOptions() {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.unlinkFailed'));

  return mutationOptions({
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
    onError: (error) => showFailure(error),
  });
}
