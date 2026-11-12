import { useTranslation } from '@src/shared/i18n';
import {
  AppleIcon,
  Button,
  GoogleIcon,
  HStack,
  KakaoIcon,
  NaverIcon,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps, ReactNode } from 'react';

import { type OAuthStartProvider } from '../domains/oauth.model';
import {
  useExchangeCodeMutationOptions,
  useOpenAppleLoginMutationOptions,
  useOpenGoogleLoginMutationOptions,
  useOpenKakaoLoginMutationOptions,
  useOpenNaverLoginMutationOptions,
} from '../queries/auth.mutations';
import { getOAuthProviderLabelKey } from '../utils/oauth-provider.view-model';

export function SocialLoginButtons() {
  const { t } = useTranslation(['auth']);
  const exchangeCode = useMutation(useExchangeCodeMutationOptions());
  const appleLogin = useMutation(useOpenAppleLoginMutationOptions());
  const kakaoLogin = useMutation(useOpenKakaoLoginMutationOptions());
  const googleLogin = useMutation(useOpenGoogleLoginMutationOptions());
  const naverLogin = useMutation(useOpenNaverLoginMutationOptions());

  // 교환에 성공하면 인증 상태로 바뀌고 Stack.Protected가 (app)으로 보낸다.
  const exchangeOnSuccess = (provider: OAuthStartProvider) => ({
    onSuccess: (code: string) => {
      exchangeCode.mutate({ code, provider });
    },
  });

  return (
    <VStack gap={8}>
      {process.env.EXPO_OS === 'ios' && (
        <SocialLoginButton
          icon={<AppleIcon width={20} height={20} colorClassName="text-white dark:text-black" />}
          label={t('login.continueWith', { provider: t(getOAuthProviderLabelKey('APPLE')) })}
          onPress={() => appleLogin.mutate()}
          isLoading={appleLogin.isPending}
          className="bg-apple-button dark:bg-apple-button-dark"
          labelClassName="text-white dark:text-black"
        />
      )}
      <SocialLoginButton
        icon={<KakaoIcon width={20} height={20} />}
        label={t('login.continueWith', { provider: t(getOAuthProviderLabelKey('KAKAO')) })}
        onPress={() => kakaoLogin.mutate(undefined, exchangeOnSuccess('kakao'))}
        isLoading={kakaoLogin.isPending || exchangeCode.isPending}
        className="bg-kakao"
        labelClassName="dark:text-gray-1"
      />
      <SocialLoginButton
        icon={<GoogleIcon width={20} height={20} />}
        label={t('login.continueWith', { provider: t(getOAuthProviderLabelKey('GOOGLE')) })}
        onPress={() => googleLogin.mutate(undefined, exchangeOnSuccess('google'))}
        isLoading={googleLogin.isPending || exchangeCode.isPending}
        className="bg-white border border-gray-3 dark:border-gray-2 dark:bg-gray-2"
        labelClassName="dark:text-gray-9"
      />
      <SocialLoginButton
        icon={<NaverIcon width={16} height={16} colorClassName="text-white" />}
        label={t('login.continueWith', { provider: t(getOAuthProviderLabelKey('NAVER')) })}
        onPress={() => naverLogin.mutate(undefined, exchangeOnSuccess('naver'))}
        isLoading={naverLogin.isPending || exchangeCode.isPending}
        className="bg-naver"
        labelClassName="text-white dark:text-gray-9"
      />
    </VStack>
  );
}

interface SocialLoginButtonProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  icon: ReactNode;
  label: string;
  labelClassName?: string;
}

function SocialLoginButton({
  icon,
  label,
  className,
  labelClassName,
  ...props
}: SocialLoginButtonProps) {
  return (
    <Button {...props} className={className}>
      <HStack align="center" gap={8}>
        {icon}
        <Text size="b4" weight="semibold" shade={9} className={labelClassName}>
          {label}
        </Text>
      </HStack>
    </Button>
  );
}
