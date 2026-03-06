import { useGetFriendsQueryOptions } from '@src/features/friend/presentations/queries/use-get-friends-query-options';
import { FeedCalendarProvider } from '@src/features/todo/presentations/providers/feed-calendar-provider';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import {
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router, Slot, useGlobalSearchParams } from 'expo-router';
import { Avatar, PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

export default function FeedGroupLayout() {
  return (
    <FeedCalendarProvider>
      <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
        <VStack>
          <QueryErrorBoundary>
            <Suspense fallback={<UserAvatarListLoading />}>
              <UserAvatarList />
            </Suspense>
          </QueryErrorBoundary>
        </VStack>
        <Slot />
      </StyledSafeAreaView>
    </FeedCalendarProvider>
  );
}

function UserAvatarList() {
  const { friendId } = useGlobalSearchParams<{ friendId?: string }>();
  const selectedFriendId = friendId ?? null;
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const {
    data: friendsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(useGetFriendsQueryOptions());

  const friends = useMemo(
    () => friendsData.pages.flatMap((page) => page.items),
    [friendsData.pages],
  );

  const handleScrollEnd = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12, alignItems: 'flex-start' }}
      onMomentumScrollEnd={handleScrollEnd}
    >
      <UserAvatarItem
        name="나"
        profileImage={user.profileImage}
        isSelected={selectedFriendId === null}
        onPress={() => router.replace('/feed')}
      />

      {friends.map((friend) => (
        <UserAvatarItem
          key={friend.followId}
          name={friend.displayName}
          profileImage={friend.profileImage}
          isSelected={selectedFriendId === friend.id}
          onPress={() => router.replace(`/feed/friend/${friend.id}`)}
        />
      ))}

      <AddFriendButton />
    </ScrollView>
  );
}

function UserAvatarListLoading() {
  return (
    <HStack px={16} gap={12}>
      {times(3).map((i) => (
        <VStack key={i} align="center" gap={4}>
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-8 rounded" />
        </VStack>
      ))}
    </HStack>
  );
}

const AddFriendButton = () => (
  <PressableFeedback onPress={() => router.push('/friends/add')}>
    <VStack align="center" gap={4}>
      <View className="size-10 items-center justify-center rounded-full bg-gray-2">
        <PlusIcon width={16} height={16} colorClassName="text-gray-5" />
      </View>
    </VStack>
  </PressableFeedback>
);

interface UserAvatarItemProps {
  name: string;
  profileImage: string | null;
  isSelected?: boolean;
  onPress?: () => void;
}

const UserAvatarItem = ({ name, profileImage, isSelected, onPress }: UserAvatarItemProps) => {
  return (
    <PressableFeedback onPress={onPress}>
      <VStack align="center" gap={4}>
        <Avatar size="sm" alt={`${name} 프로필`}>
          <Avatar.Image source={getProfileIconSource(profileImage)} />
        </Avatar>
        <Text size="e1" shade={isSelected ? 9 : 6} weight={isSelected ? 'semibold' : 'normal'}>
          {name}
        </Text>
      </VStack>
    </PressableFeedback>
  );
};
