import { useGetFriendsInfiniteQueryOptions } from '@src/features/friend/queries/get-friends-infinite-query-options';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  PlusIcon,
  Result,
  type QueryErrorFallbackProps,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import {
  usePrefetchInfiniteQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { useFeedFriendIdParam } from '../hooks/use-feed-friend-id-param';

/** 피드 상단에서 나와 친구를 골라 그 사람의 피드로 바꾸는 가로 아바타 목록. */
export function FeedAvatarList() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const [selectedFriendId, setSelectedFriendId] = useFeedFriendIdParam();
  const selectFriend = useSingleTap(setSelectedFriendId);
  const friendsQueryOptions = useGetFriendsInfiniteQueryOptions();
  usePrefetchInfiniteQuery(friendsQueryOptions);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const {
    data: friendsData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(friendsQueryOptions);

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
        <FeedAvatarList.Item
          name={t('feed.me')}
          image={user.profileImage}
          isSelected={selectedFriendId == null}
          onPress={() => selectFriend(undefined)}
        />

        {friends.map((friend) => (
          <FeedAvatarList.Item
            key={friend.followId}
            name={friend.displayName}
            image={friend.profileImage}
            isSelected={selectedFriendId === friend.id}
            onPress={() => selectFriend(friend.id)}
          />
        ))}

        {isFetchNextPageError && <MoreErrorButton onPress={handleScrollEnd} />}

        <AddFriendButton onPress={() => push('/friends/search')} />
      </StyledSafeAreaView>
    </ScrollView>
  );
}

interface FeedAvatarListItemProps {
  name: string;
  image: string | null;
  isSelected?: boolean;
  onPress?: () => void;
}

FeedAvatarList.Item = function Item({ name, image, isSelected, onPress }: FeedAvatarListItemProps) {
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

FeedAvatarList.Loading = function Loading() {
  return (
    <Box px={16}>
      <StyledSafeAreaView edges={['left', 'right']} className="flex-row items-start gap-3">
        {times(3, (index) => (
          <VStack key={index} align="center" gap={4}>
            <Skeleton className="size-10 rounded-full" />
            <TextSkeleton size="e1" className="w-8" />
          </VStack>
        ))}
      </StyledSafeAreaView>
    </Box>
  );
};

FeedAvatarList.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
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

function AddFriendButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableFeedback onPress={onPress}>
      <VStack align="center" gap={4}>
        <Box className="size-10 items-center justify-center rounded-full bg-gray-2">
          <PlusIcon width={16} height={16} colorClassName="text-gray-5" />
        </Box>
      </VStack>
    </PressableFeedback>
  );
}

function MoreErrorButton({ onPress }: { onPress: () => void }) {
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
}
