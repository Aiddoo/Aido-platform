import appIconImage from '@assets/images/icon.png';
import { useExchangeCodeMutationOptions } from '@src/features/auth/presentations/queries/use-exchange-code-mutation-options';
import { useOpenAppleLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-apple-login-mutation-options';
import { useOpenGoogleLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-google-login-mutation-options';
import { useOpenKakaoLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-kakao-login-mutation-options';
import { useOpenNaverLoginMutationOptions } from '@src/features/auth/presentations/queries/use-open-naver-login-mutation-options';

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
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Avatar, Separator } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { Platform } from 'react-native';

const LoginScreen = () => {
  const exchangeCodeMutation = useMutation(useExchangeCodeMutationOptions());

  const kakaoLoginMutation = useMutation(useOpenKakaoLoginMutationOptions());

  const handleKakaoLogin = () => {
    kakaoLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          // exchangeCode 성공 시 AuthProvider가 status를 'authenticated'로 변경하고
          // Stack.Protected가 자동으로 (app) 그룹으로 라우팅 처리
          exchangeCodeMutation.mutate({ code });
        }
      },
    });
  };

  const naverLoginMutation = useMutation(useOpenNaverLoginMutationOptions());
  const handleNaverLogin = () => {
    naverLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          exchangeCodeMutation.mutate({ code });
        }
      },
    });
  };

  const googleLoginMutation = useMutation(useOpenGoogleLoginMutationOptions());
  const handleGoogleLogin = () => {
    googleLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          exchangeCodeMutation.mutate({ code });
        }
      },
    });
  };

  const appleLoginMutation = useMutation(useOpenAppleLoginMutationOptions());
  const handleAppleLogin = () => {
    appleLoginMutation.mutate(undefined);
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <VStack flex={1} px={16}>
        <VStack flex={1} align="center" justify="center" gap={8}>
          <Avatar alt="Aido logo" size="lg" className="rounded-xl">
            <Avatar.Image source={appIconImage} />
          </Avatar>
          <VStack align="center">
            <H1>Aido</H1>
            <Text size="b4" shade={6}>
              할 일을 미루지 않고, I DO
            </Text>
          </VStack>
        </VStack>

        <VStack gap={24}>
          <VStack gap={12}>
            <SocialLoginButton
              icon={<KakaoIcon width={20} height={20} />}
              label="카카오로 계속하기"
              onPress={handleKakaoLogin}
              isLoading={kakaoLoginMutation.isPending || exchangeCodeMutation.isPending}
              className="bg-kakao"
              labelClassName="dark:text-gray-1"
            />

            <SocialLoginButton
              icon={<GoogleIcon width={20} height={20} />}
              label="Google로 계속하기"
              onPress={handleGoogleLogin}
              isLoading={googleLoginMutation.isPending || exchangeCodeMutation.isPending}
              className="bg-white border border-gray-2 dark:border-gray-2 dark:bg-gray-2"
              labelClassName="dark:text-gray-9"
            />
          </VStack>

          <HStack align="center" gap={12}>
            <Separator className="flex-1" />
            <Text tone="neutral" shade={5} size="e1">
              또는
            </Text>
            <Separator className="flex-1" />
          </HStack>

          <HStack justify="center" gap={16}>
            {Platform.OS === 'ios' && (
              <SocialLoginIconButton
                icon={<AppleIcon width={20} height={20} />}
                onPress={handleAppleLogin}
                isLoading={appleLoginMutation.isPending}
                className="bg-black dark:border dark:border-gray-2"
              />
            )}
            <SocialLoginIconButton
              icon={<NaverIcon width={16} height={16} />}
              onPress={handleNaverLogin}
              isLoading={naverLoginMutation.isPending || exchangeCodeMutation.isPending}
              className="bg-naver"
            />
          </HStack>
        </VStack>

        <Spacing size={32} />

        <HStack justify="center" align="center" gap={8} pb={40}>
          <TextButton size="medium" onPress={() => router.push('/sign-up')}>
            회원가입
          </TextButton>

          <Separator orientation="vertical" className="h-3 bg-gray-6" />

          <TextButton size="medium" onPress={() => router.push('/email-login')}>
            이메일로 로그인
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

interface SocialLoginIconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: ReactNode;
}

const SocialLoginIconButton = ({ icon, className, ...props }: SocialLoginIconButtonProps) => {
  return (
    <Button display="inline" radius="full" {...props} className={cn('size-14', className)}>
      {icon}
    </Button>
  );
};
