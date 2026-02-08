import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { UserAvatarList } from '@src/features/todo/presentations/components/UserAvatarList';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Suspense, useState } from 'react';
import { IOScrollView } from 'react-native-intersection-observer';

const TODAY = new Date();

const FeedScreen = () => {
  const [selectedDate, setSelectedDate] = useState(TODAY);

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
