import appIconImage from '@assets/images/profile-icons/default.webp';
import type { OAuthStartProvider } from '@src/features/auth/domains/oauth.model';
import { useExchangeCodeMutationOptions } from '@src/features/auth/queries/use-exchange-code-mutation-options';
import { useOpenAppleLoginMutationOptions } from '@src/features/auth/queries/use-open-apple-login-mutation-options';
import { useOpenGoogleLoginMutationOptions } from '@src/features/auth/queries/use-open-google-login-mutation-options';
import { useOpenKakaoLoginMutationOptions } from '@src/features/auth/queries/use-open-kakao-login-mutation-options';
import { useOpenNaverLoginMutationOptions } from '@src/features/auth/queries/use-open-naver-login-mutation-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useTheme } from '@src/shared/providers/theme-provider';
import {
  AppleIcon,
  Button,
  GoogleIcon,
  H1,
  HStack,
  KakaoIcon,
  NaverIcon,
  ReadableContent,
  Spacing,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Avatar, Separator } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { Platform } from 'react-native';

function LoginScreen() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('auth');
  const exchangeCodeMutation = useMutation(useExchangeCodeMutationOptions());

  const kakaoLoginMutation = useMutation(useOpenKakaoLoginMutationOptions());
  const naverLoginMutation = useMutation(useOpenNaverLoginMutationOptions());
  const googleLoginMutation = useMutation(useOpenGoogleLoginMutationOptions());

  // 교환에 성공하면 AuthProvider가 인증 상태로 바꾸고 Stack.Protected가 (app)으로 보낸다.
  const exchangeCodeOf = (provider: OAuthStartProvider) => ({
    onSuccess: (code: string | null) => {
      if (code) {
        exchangeCodeMutation.mutate({ code, provider });
      }
    },
  });

  const appleLoginMutation = useMutation(useOpenAppleLoginMutationOptions());

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <StyledSafeAreaView className="flex-1 bg-white mb-2">
      <ReadableContent flex={1} px={16}>
        <VStack flex={1} align="center" justify="center" gap={8}>
          <Avatar alt={t('login.logoAlt')} size="lg" className="rounded-xl">
            <Avatar.Image source={appIconImage} />
          </Avatar>
          <VStack align="center">
            <H1>Aido</H1>
            <Text size="b4" shade={6}>
              {t('login.slogan')}
            </Text>
          </VStack>
        </VStack>

        <VStack gap={8}>
          {Platform.OS === 'ios' && (
            <SocialLoginButton
              icon={
                <AppleIcon
                  width={20}
                  height={20}
                  colorClassName={isDark ? 'text-black' : 'text-white'}
                />
              }
              label={t('login.continueWith', { provider: t('providers.APPLE') })}
              onPress={() => appleLoginMutation.mutate()}
              isLoading={appleLoginMutation.isPending}
              className="bg-apple-button dark:bg-apple-button-dark"
              labelClassName="text-white dark:text-black"
            />
          )}
          <SocialLoginButton
            icon={<KakaoIcon width={20} height={20} />}
            label={t('login.continueWith', { provider: t('providers.KAKAO') })}
            onPress={() => kakaoLoginMutation.mutate(undefined, exchangeCodeOf('kakao'))}
            isLoading={kakaoLoginMutation.isPending || exchangeCodeMutation.isPending}
            className="bg-kakao"
            labelClassName="dark:text-gray-1"
          />
          <SocialLoginButton
            icon={<GoogleIcon width={20} height={20} />}
            label={t('login.continueWith', { provider: t('providers.GOOGLE') })}
            onPress={() => googleLoginMutation.mutate(undefined, exchangeCodeOf('google'))}
            isLoading={googleLoginMutation.isPending || exchangeCodeMutation.isPending}
            className="bg-white border border-gray-3 dark:border-gray-2 dark:bg-gray-2"
            labelClassName="dark:text-gray-9"
          />
          <SocialLoginButton
            icon={<NaverIcon width={16} height={16} colorClassName="text-white" />}
            label={t('login.continueWith', { provider: t('providers.NAVER') })}
            onPress={() => naverLoginMutation.mutate(undefined, exchangeCodeOf('naver'))}
            isLoading={naverLoginMutation.isPending || exchangeCodeMutation.isPending}
            className="bg-naver"
            labelClassName="text-white dark:text-gray-9"
          />
        </VStack>

        <Spacing size={24} />

        <HStack justify="center" align="center" gap={8} pb={40}>
          <TextButton size="medium" onPress={() => push('/sign-up')}>
            {t('login.signUp')}
          </TextButton>

          <Separator orientation="vertical" className="h-3 bg-gray-6" />

          <TextButton size="medium" onPress={() => push('/email-login')}>
            {t('login.emailLogin')}
          </TextButton>
        </HStack>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

export default LoginScreen;

type ButtonProps = ComponentProps<typeof Button>;

interface SocialLoginButtonProps extends Omit<ButtonProps, 'children'> {
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
