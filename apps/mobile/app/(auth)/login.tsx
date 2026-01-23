import { exchangeCodeMutationOptions } from '@src/features/auth/presentations/queries/exchange-code-mutation-options';
import { openKakaoLoginMutationOptions } from '@src/features/auth/presentations/queries/open-kakao-login-mutation-options';
import { openNaverLoginMutationOptions } from '@src/features/auth/presentations/queries/open-naver-login-mutation-options';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { AppleIcon, GoogleIcon, KakaoIcon, NaverIcon } from '@src/shared/ui/Icon';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { H1 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils';
import { useMutation } from '@tanstack/react-query';
import { Avatar, Divider } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

const LoginScreen = () => {
  const exchangeCodeMutation = useMutation(exchangeCodeMutationOptions());

  const kakaoLoginMutation = useMutation(openKakaoLoginMutationOptions());
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

  const naverLoginMutation = useMutation(openNaverLoginMutationOptions());
  const handleNaverLogin = () => {
    naverLoginMutation.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          exchangeCodeMutation.mutate({ code });
        }
      },
    });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <VStack flex={1} px={16}>
        <VStack flex={1} align="center" justify="center" gap={8}>
          <Avatar alt="Aido logo" size="lg" className="rounded-xl">
            <Avatar.Image source={require('@assets/images/icon.png')} />
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
            />

            <SocialLoginButton
              icon={<GoogleIcon width={20} height={20} />}
              label="Google로 계속하기"
              onPress={() => {}}
              className="bg-white border border-gray-200"
            />
          </VStack>

          <HStack align="center" gap={12}>
            <Divider className="flex-1" />
            <Text tone="neutral" shade={5} size="e1">
              또는
            </Text>
            <Divider className="flex-1" />
          </HStack>

          <HStack justify="center" gap={16}>
            <SocialLoginIconButton
              icon={<AppleIcon width={20} height={20} />}
              onPress={() => {}}
              className="bg-black"
            />
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
          <TextButton size="medium" onPress={() => {}}>
            회원가입
          </TextButton>

          <Divider orientation="vertical" className="h-3 bg-gray-6" />

          <TextButton size="medium" onPress={() => {}}>
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
}

const SocialLoginButton = ({ icon, label, className, ...props }: SocialLoginButtonProps) => {
  return (
    <Button {...props} className={className}>
      <HStack align="center" gap={8}>
        {icon}
        <Text size="b4" weight="semibold" shade={9}>
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
