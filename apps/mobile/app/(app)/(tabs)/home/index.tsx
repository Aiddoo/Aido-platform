import { getMeQueryOptions } from '@src/features/auth/presentations/queries/get-me-query-options';
import { logoutMutationOptions } from '@src/features/auth/presentations/queries/logout-mutation-options';
import { Button } from '@src/shared/ui/Button/Button';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

const HomeScreen = () => {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const logout = useMutation(logoutMutationOptions());

  const handleLogout = () => {
    logout.mutate();
  };

  if (!user) return null;

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <VStack px={16} py={20} gap={16}>
        <Text>안녕하세요, {user.name}님!</Text>
        <Text shade={6}>{user.email}</Text>
      </VStack>
      <VStack px={16}>
        <Button onPress={handleLogout} isLoading={logout.isPending} color="danger">
          로그아웃
        </Button>
      </VStack>
    </StyledSafeAreaView>
  );
};

export default HomeScreen;
