import { useGetMe } from '@src/features/auth/presentation/hooks/use-get-me';
import { useLogout } from '@src/features/auth/presentation/hooks/use-logout';
import { Button } from '@src/shared/ui/Button/Button';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace('/(auth)/login');
      },
    });
  };

  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <VStack px={16} py={20} gap={16}>
        <Text>안녕하세요, {user.name}님!</Text>
        <Text shade={6}>{user.email}</Text>
      </VStack>
      <VStack px={16}>
        <Button onPress={handleLogout} isLoading={logout.isPending} color="danger">
          로그아웃
        </Button>
      </VStack>
    </SafeAreaView>
  );
}
