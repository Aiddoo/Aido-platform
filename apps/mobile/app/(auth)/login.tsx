import { LoginBranding } from '@src/features/auth/presentation/components/login-branding';
import { LoginFooter } from '@src/features/auth/presentation/components/login-footer';
import { SocialLoginGroup } from '@src/features/auth/presentation/components/social-login-group';
import { useExchangeCode } from '@src/features/auth/presentation/hooks/use-exchange-code';
import { useOpenKakaoLogin } from '@src/features/auth/presentation/hooks/use-open-kakao-login';
import { VStack } from '@src/shared/ui/VStack/VStack';

import { useRouter } from 'expo-router';
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
      <VStack flex={1} px={16} py={20}>
        <LoginBranding
          logo={require('../../assets/images/icon.png')}
          title="Aido"
          tagline="할 일을 미루지 않고, I DO"
        />
        <SocialLoginGroup
          primary={[
            {
              provider: 'kakao',
              onPress: handleKakaoLogin,
              loading: openKakaoLogin.isPending || exchangeCode.isPending,
            },
            { provider: 'apple', onPress: () => {}, loading: false },
          ]}
          secondary={['google', 'naver']}
          onSecondaryPress={(provider) => console.log(`${provider} login`)}
        />
        <LoginFooter
          links={[
            { label: '회원가입', onPress: () => {} },
            { label: '이메일로 로그인', onPress: () => {} },
          ]}
        />
      </VStack>
    </SafeAreaView>
  );
}
