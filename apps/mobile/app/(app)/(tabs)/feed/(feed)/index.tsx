import MagicIcon from '@assets/icons/ic_magic.svg';
import { useGetSuggestionsQueryOptions } from '@src/features/ai/presentations/queries/use-get-suggestions-query-options';
import { Calendar } from '@src/features/todo/presentations/components/Calendar/Calendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedCalendar } from '@src/features/todo/presentations/providers/feed-calendar-provider';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { LAYOUT } from '@src/shared/constants/layout.constant';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { Box, ListRow, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Suspense, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

const MyFeedScreen = () => {
  const { selectedDate } = useFeedCalendar();
  const queryClient = useQueryClient();
  const invalidateTodos = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
        queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
      ]),
    [queryClient],
  );
  const [refreshing, onRefresh] = useRefresh(invalidateTodos);

  return (
    <NestableScrollContainer
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: LAYOUT.tabBarOverlayPadding }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Calendar />

      <Spacing size={8} />

      <QueryErrorBoundary>
        <Suspense fallback={<TodoList.Loading />}>
          <TodoList date={selectedDate} />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={20} />

      <Box px={16}>
        <SuggestionEntryCard />
      </Box>
    </NestableScrollContainer>
  );
};

export default MyFeedScreen;

function getEntryLabel(isPremium: boolean, name: string, count: number) {
  if (!isPremium) return '딱 맞는 루틴을 제안해드려요 !';
  if (count > 0) return `${name}님, ${count}개의 맞춤 제안이 도착했어요 !`;
  return '이번 주 제안을 준비 중이에요';
}

function SuggestionEntryCard() {
  const router = useRouter();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);

  const { data: suggestions } = useQuery({
    ...useGetSuggestionsQueryOptions(),
    enabled: isPremium,
  });
  const suggestionCount = suggestions?.length ?? 0;

  const label = getEntryLabel(isPremium, user.name, suggestionCount);

  return (
    <PressableFeedback
      onPress={() => router.push('/suggestions')}
      className="rounded-xl bg-gray-1 px-4"
    >
      <ListRow
        left={<MagicIcon width={24} height={24} />}
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{ size: 'b3', weight: 'medium', shade: 8 }}
          />
        }
      />
    </PressableFeedback>
  );
}
