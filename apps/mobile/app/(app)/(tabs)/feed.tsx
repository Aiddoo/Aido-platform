import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { UserAvatarList } from '@src/features/todo/presentations/components/UserAvatarList';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Suspense, useState } from 'react';

const TODAY = new Date();

const FeedScreen = () => {
  const [selectedDate, setSelectedDate] = useState(TODAY);

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <VStack flex={1}>
        <VStack py={12}>
          <QueryErrorBoundary>
            <Suspense fallback={<UserAvatarList.Loading />}>
              <UserAvatarList />
            </Suspense>
          </QueryErrorBoundary>
        </VStack>

        <Calendar value={selectedDate} onChange={setSelectedDate} />

        <Spacing size={16} />

        <VStack flex={1}>
          <QueryErrorBoundary>
            <Suspense fallback={<TodoList.Loading />}>
              <TodoList date={selectedDate} />
            </Suspense>
          </QueryErrorBoundary>
        </VStack>
      </VStack>
    </StyledSafeAreaView>
  );
};

export default FeedScreen;
