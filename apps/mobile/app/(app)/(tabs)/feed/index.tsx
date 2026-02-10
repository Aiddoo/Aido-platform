import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { FriendTodoList } from '@src/features/todo/presentations/components/FriendTodoList';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import type { SelectedUser } from '@src/features/todo/presentations/components/UserAvatarList';
import { UserAvatarList } from '@src/features/todo/presentations/components/UserAvatarList';
import { useToday } from '@src/shared/hooks/useToday';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Suspense, useEffect, useState } from 'react';
import { Image, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

const FeedScreen = () => {
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedUser, setSelectedUser] = useState<SelectedUser>({ type: 'me' });

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <VStack>
        <QueryErrorBoundary>
          <Suspense fallback={<UserAvatarList.Loading />}>
            <UserAvatarList value={selectedUser} onChange={setSelectedUser} />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
        <Calendar
          value={selectedDate}
          onChange={setSelectedDate}
          showCompletions={selectedUser.type === 'me'}
        />

        <Spacing size={8} />

        <QueryErrorBoundary>
          {match(selectedUser)
            .with({ type: 'me' }, () => (
              <Suspense fallback={<TodoList.Loading />}>
                <TodoList date={selectedDate} />
              </Suspense>
            ))
            .with({ type: 'friend' }, (friend) => (
              <>
                <PokeBanner />
                <Spacing size={16} />
                <Suspense fallback={<FriendTodoList.Loading />}>
                  <FriendTodoList friend={friend} date={selectedDate} />
                </Suspense>
              </>
            ))
            .exhaustive()}
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default FeedScreen;

function PokeBanner() {
  return (
    <HStack mx={16} px={12} className="rounded-xl bg-gray-1" align="center" gap={12}>
      <Image
        source={require('@assets/images/aido_banner.webp')}
        style={{ width: 72, height: 72 }}
        resizeMode="contain"
      />
      <VStack flex={1}>
        <Text size="b3" weight="medium">
          친구를{' '}
          <Text size="b3" weight="bold" className="text-main">
            콕
          </Text>{' '}
          찌를까요?
        </Text>
        <Text size="e1" shade={6}>
          잊고 있는 것 같다면 🐾 을 눌러 알림을 보내보세요!
        </Text>
      </VStack>
    </HStack>
  );
}
