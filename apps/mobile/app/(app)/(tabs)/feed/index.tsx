import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { UserAvatarList } from '@src/features/todo/presentations/components/UserAvatarList';
import { useToday } from '@src/shared/hooks/useToday';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Suspense, useEffect, useState } from 'react';
import { IOScrollView } from 'react-native-intersection-observer';

const FeedScreen = () => {
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <VStack>
        <QueryErrorBoundary>
          <Suspense fallback={<UserAvatarList.Loading />}>
            <UserAvatarList />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>

      <IOScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        <Calendar value={selectedDate} onChange={setSelectedDate} />

        <Spacing size={8} />

        <QueryErrorBoundary>
          <Suspense fallback={<TodoList.Loading />}>
            <TodoList date={selectedDate} />
          </Suspense>
        </QueryErrorBoundary>
      </IOScrollView>
    </StyledSafeAreaView>
  );
};

export default FeedScreen;
