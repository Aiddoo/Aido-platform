import { VStack } from '@src/core/component/ui/VStack';
import { useAuthClient } from '@src/features/auth/presentations/contexts/auth.context';
import { useExchangeCodeMutationOptions } from '@src/features/auth/presentations/hooks';
import {
  LoginBranding,
  LoginFooter,
  SocialLoginGroup,
} from '@src/features/auth/presentations/ui/components';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const authClient = useAuthClient();
  const router = useRouter();

  const exchangeMutation = useMutation(useExchangeCodeMutationOptions(authClient));

  const handleKakaoLogin = async () => {
    const code = await authClient.authService.openKakaoLogin();
    if (code) {
      exchangeMutation.mutate(code, {
        onSuccess: () => {
          router.replace('/(app)/home');
        },
      });
    }
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
            { provider: 'kakao', onPress: handleKakaoLogin, loading: exchangeMutation.isPending },
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
