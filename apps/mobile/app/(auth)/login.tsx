import AppleIcon from '@assets/icons/ic_apple.svg';
import GoogleIcon from '@assets/icons/ic_google.svg';
import KakaoIcon from '@assets/icons/ic_kakao.svg';
import NaverIcon from '@assets/icons/ic_naver.svg';
import { useExchangeCode } from '@src/features/auth/presentation/hooks/use-exchange-code';
import { useOpenKakaoLogin } from '@src/features/auth/presentation/hooks/use-open-kakao-login';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { H1 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useRouter } from 'expo-router';
import { Avatar, Divider } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();

  const openKakaoLogin = useOpenKakaoLogin();
  const exchangeCode = useExchangeCode();

  const handleKakaoLogin = () => {
    openKakaoLogin.mutate(undefined, {
      onSuccess: (code) => {
        if (code) {
          exchangeCode.mutate(code, {
            onSuccess: () => {
              router.replace('/(app)/home');
            },
          });
        }
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
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
              isLoading={openKakaoLogin.isPending || exchangeCode.isPending}
              className="bg-[#FEE500]"
            />

            <SocialLoginButton
              icon={<GoogleIcon width={20} height={20} />}
              label="Google로 계속하기"
              onPress={() => console.log('google login')}
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
              onPress={() => console.log('apple login')}
              className="bg-black"
            />
            <SocialLoginIconButton
              icon={<NaverIcon width={16} height={16} />}
              onPress={() => console.log('naver login')}
              className="bg-[#03C75A]"
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
    </SafeAreaView>
  );
}

type ButtonProps = ComponentProps<typeof Button>;

interface SocialLoginButtonProps extends Omit<ButtonProps, 'children'> {
  icon: ReactNode;
  label: string;
}

function SocialLoginButton({ icon, label, className, ...props }: SocialLoginButtonProps) {
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
}

interface SocialLoginIconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: ReactNode;
}

function SocialLoginIconButton({ icon, className, ...props }: SocialLoginIconButtonProps) {
  const mergedClassName = ['size-14', className].filter(Boolean).join(' ');

  return (
    <Button display="inline" radius="full" {...props} className={mergedClassName}>
      {icon}
    </Button>
  );
}
