import appIconImage from '@assets/images/icon.png';
import { useExchangeCodeMutationOptions } from '@src/features/auth/presentations/queries/use-exchange-code-mutation-options';
import { useOpenAppleLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-apple-login-mutation-options';
import { useOpenGoogleLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-google-login-mutation-options';
import { useOpenKakaoLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-kakao-login-mutation-options';
import { useOpenNaverLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-naver-login-mutation-options';
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

const LoginScreen = () => {
  const { t } = useTranslation('auth');
  const exchangeCodeMutation = useMutation(useExchangeCodeMutationOptions());

  const kakaoLoginMutation = useMutation(useOpenKakaoLoginMutationOptions());

  const handleKakaoLogin = () => {
    kakaoLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          // exchangeCode 성공 시 AuthProvider가 status를 'authenticated'로 변경하고
          // Stack.Protected가 자동으로 (app) 그룹으로 라우팅 처리
          exchangeCodeMutation.mutate({ code, provider: 'kakao' });
        }
      },
    });
  };

  const naverLoginMutation = useMutation(useOpenNaverLoginMutationOptions());
  const handleNaverLogin = () => {
    naverLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          exchangeCodeMutation.mutate({ code, provider: 'naver' });
        }
      },
    });
  };

  const googleLoginMutation = useMutation(useOpenGoogleLoginMutationOptions());
  const handleGoogleLogin = () => {
    googleLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          exchangeCodeMutation.mutate({ code, provider: 'google' });
        }
      },
    });
  };

  const appleLoginMutation = useMutation(useOpenAppleLoginMutationOptions());
  const handleAppleLogin = () => {
    appleLoginMutation.mutate(undefined);
  };

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <StyledSafeAreaView className="flex-1 bg-white mb-2">
      <VStack flex={1} px={16}>
        <VStack flex={1} align="center" justify="center" gap={8}>
          <Avatar alt="Aido logo" size="lg" className="rounded-xl">
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
              onPress={handleAppleLogin}
              isLoading={appleLoginMutation.isPending}
              className="bg-apple-button dark:bg-apple-button-dark"
              labelClassName="text-white dark:text-black"
            />
          )}
          <SocialLoginButton
            icon={<KakaoIcon width={20} height={20} />}
            label={t('login.continueWith', { provider: t('providers.KAKAO') })}
            onPress={handleKakaoLogin}
            isLoading={kakaoLoginMutation.isPending || exchangeCodeMutation.isPending}
            className="bg-kakao"
            labelClassName="dark:text-gray-1"
          />
          <SocialLoginButton
            icon={<GoogleIcon width={20} height={20} />}
            label={t('login.continueWith', { provider: t('providers.GOOGLE') })}
            onPress={handleGoogleLogin}
            isLoading={googleLoginMutation.isPending || exchangeCodeMutation.isPending}
            className="bg-white border border-gray-3 dark:border-gray-2 dark:bg-gray-2"
            labelClassName="dark:text-gray-9"
          />
          <SocialLoginButton
            icon={<NaverIcon width={16} height={16} colorClassName="text-white" />}
            label={t('login.continueWith', { provider: t('providers.NAVER') })}
            onPress={handleNaverLogin}
            isLoading={naverLoginMutation.isPending || exchangeCodeMutation.isPending}
            className="bg-naver"
            labelClassName="text-white dark:text-gray-9"
          />
        </VStack>

        <Spacing size={24} />

        <HStack justify="center" align="center" gap={8} pb={40}>
          <TextButton size="medium" onPress={() => router.push('/sign-up')}>
            {t('login.signUp')}
          </TextButton>

          <Separator orientation="vertical" className="h-3 bg-gray-6" />

          <TextButton size="medium" onPress={() => router.push('/email-login')}>
            {t('login.emailLogin')}
          </TextButton>
        </HStack>
      </VStack>
    </StyledSafeAreaView>
  );
};

export default LoginScreen;

type ButtonProps = ComponentProps<typeof Button>;

interface SocialLoginButtonProps extends Omit<ButtonProps, 'children'> {
  icon: ReactNode;
  label: string;
  labelClassName?: string;
}

const SocialLoginButton = ({
  icon,
  label,
  className,
  labelClassName,
  ...props
}: SocialLoginButtonProps) => {
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
};
