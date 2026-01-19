import { useGetMe } from '@src/features/auth/presentation/hooks/use-get-me';
import { useLogout } from '@src/features/auth/presentation/hooks/use-logout';
import { Text } from '@src/shared/ui/Text/Text';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
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
      <Text>안녕하세요, {user.name}님!</Text>
      <Text className="mt-2 text-base text-gray-600">{user.email}</Text>

      <Button onPress={handleLogout} isDisabled={logout.isPending} className="bg-red-500">
        로그아웃
      </Button>
    </SafeAreaView>
  );
}
