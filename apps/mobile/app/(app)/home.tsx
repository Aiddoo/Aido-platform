import { Text } from '@src/core/component/ui/Text';
import { useAuthClient } from '@src/features/auth/presentations/contexts/auth.context';
import {
  useGetMeQueryOptions,
  useLogoutMutationOptions,
} from '@src/features/auth/presentations/hooks';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const authClient = useAuthClient();
  const router = useRouter();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions(authClient));
  const { mutate: logout, isPending } = useMutation(useLogoutMutationOptions(authClient));

  const handleLogout = () => {
    logout(undefined, {
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

      <Button onPress={handleLogout} isDisabled={isPending} className="bg-red-500">
        로그아웃
      </Button>
    </SafeAreaView>
  );
}
