import { userIdParamSchema } from '@aido/api';
import { useGetFriendsInfiniteQueryOptions } from '@src/features/friend/queries/get-friends-infinite-query-options';
import { TodoDetailPane } from '@src/features/todo-comment/components/todo-detail-pane/todo-detail-pane';
import { useTodoCommentRoute } from '@src/features/todo-comment/hooks/use-todo-comment-route';
import { serializeTodoCommentRoute } from '@src/features/todo-comment/utils/navigation/todo-comment-route';
import { CalendarProvider } from '@src/features/todo/components/providers/calendar-provider';
import { FeedRouteParamsProvider } from '@src/features/todo/components/providers/feed-route-params-provider';
import { useFeedSelectedTodo } from '@src/features/todo/hooks/use-feed-selected-todo';
import { feedDateParamSchema } from '@src/features/todo/utils/feed-date-param';
import { createFeedHref } from '@src/features/todo/utils/feed-route';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useCompactDetailHandoff } from '@src/shared/hooks/use-compact-detail-handoff';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useRouteSearchParams } from '@src/shared/providers/route-search-params-provider';
import {
  AdaptivePane,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  Box,
  Result,
  type QueryErrorFallbackProps,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Slot, router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { z } from 'zod';

export default function FeedGroupLayout() {
  return (
    <FeedRouteParamsProvider>
      <CalendarProvider>
        <AdaptivePane primary={<FeedListPane />} secondary={<FeedDetailPane />} />
      </CalendarProvider>
    </FeedRouteParamsProvider>
  );
}

function FeedListPane() {
  const [selectedTodoId] = useFeedSelectedTodo();
  const [commentRoute] = useTodoCommentRoute();

  useCompactDetailHandoff(selectedTodoId, (todoId) => {
    router.setParams({
      todoId: undefined,
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
    });
    router.push({
      pathname: '/todo/[todoId]',
      params: { todoId, ...serializeTodoCommentRoute(commentRoute) },
    });
  });

  return (
    <Box flex={1} className="bg-white">
      <QueryErrorBoundary fallback={(props) => <AvatarList.Error {...props} />}>
        <Suspense fallback={<AvatarList.Loading />}>
          <AvatarList />
        </Suspense>
      </QueryErrorBoundary>
      <Slot />
    </Box>
  );
}

function FeedDetailPane() {
  const [selectedTodoId] = useFeedSelectedTodo();

  if (selectedTodoId === undefined) {
    return <TodoDetailPane.Empty />;
  }

  return <TodoDetailPane key={selectedTodoId} presentation="pane" />;
}

const FeedLayoutParamsSchema = z.object({
  friendId: userIdParamSchema.shape.userId.optional().catch(undefined),
  date: feedDateParamSchema,
});

function AvatarList() {
  const push = useSingleTap(router.push);
  const replace = useSingleTap(router.replace);

  const { t } = useTranslation('todo');
  const { friendId, date } = FeedLayoutParamsSchema.parse(useRouteSearchParams());
  const selectedFriendId = friendId ?? null;
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const {
    data: friendsData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(useGetFriendsInfiniteQueryOptions());

  const friends = useMemo(
    () => friendsData.pages.flatMap((page) => page.items),
    [friendsData.pages],
  );

  const handleScrollEnd = () => {
    if (hasNextPage && !isFetching) {
      fetchNextPage({ cancelRefetch: false }).catch(() => undefined);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      onMomentumScrollEnd={handleScrollEnd}
    >
      <StyledSafeAreaView edges={['left', 'right']} className="flex-row items-start gap-3">
        <AvatarList.Item
          name={t('feed.me')}
          image={user.profileImage}
          isSelected={selectedFriendId === null}
          onPress={() => replace(createFeedHref(null, date))}
        />

        {friends.map((friend) => (
          <AvatarList.Item
            key={friend.followId}
            name={friend.displayName}
            image={friend.profileImage}
            isSelected={selectedFriendId === friend.id}
            onPress={() => replace(createFeedHref(friend.id, date))}
          />
        ))}

        {isFetchNextPageError && <AvatarList.MoreError onPress={handleScrollEnd} />}

        <AvatarList.AddButton onPress={() => push('/friends/search')} />
      </StyledSafeAreaView>
    </ScrollView>
  );
}

AvatarList.Loading = function Loading() {
  return (
    <StyledSafeAreaView edges={['left', 'right']}>
      <HStack px={16} gap={12}>
        {range(3).map((i) => (
          <VStack key={i} align="center" gap={4}>
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-8 rounded" />
          </VStack>
        ))}
      </HStack>
    </StyledSafeAreaView>
  );
};

interface AvatarListItemProps {
  name: string;
  image: string | null;
  isSelected?: boolean;
  onPress?: () => void;
}

AvatarList.Item = function Item({ name, image, isSelected, onPress }: AvatarListItemProps) {
  const { t } = useTranslation('todo');
  return (
    <PressableFeedback onPress={onPress}>
      <VStack align="center" gap={4}>
        <UserAvatar size="sm" alt={t('feed.avatarAlt', { name })} profileImage={image} />
        <Text
          size="e1"
          shade={isSelected ? 9 : 6}
          weight={isSelected ? 'semibold' : 'normal'}
          numberOfLines={1}
          className="max-w-[48px]"
        >
          {name}
        </Text>
      </VStack>
    </PressableFeedback>
  );
};

AvatarList.AddButton = function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableFeedback onPress={onPress}>
      <VStack align="center" gap={4}>
        <View className="size-10 items-center justify-center rounded-full bg-gray-2">
          <PlusIcon width={16} height={16} colorClassName="text-gray-5" />
        </View>
      </VStack>
    </PressableFeedback>
  );
};

AvatarList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['friend', 'common']);
  return (
    <StyledSafeAreaView edges={['left', 'right']}>
      <HStack px={16} py={8} gap={8} align="center">
        <Text size="b4" shade={6} className="flex-1">
          {t('friend:list.loadFailed')}
        </Text>
        <Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>
      </HStack>
    </StyledSafeAreaView>
  );
};

AvatarList.MoreError = function MoreError({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation('common');
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-11 justify-center rounded-xl bg-gray-1 px-3"
    >
      <Text size="b4" tone="brand">
        {t('errorBoundary.retry')}
      </Text>
    </PressableFeedback>
  );
};
