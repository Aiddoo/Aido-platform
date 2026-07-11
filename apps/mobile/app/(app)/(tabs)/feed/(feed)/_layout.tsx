import { useGetFriendsQueryOptions } from '@src/features/friend/presentations/queries/use-get-friends-query-options';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useTranslation } from '@src/shared/i18n';
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
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <VStack>
        <QueryErrorBoundary>
          <Suspense fallback={<AvatarList.Loading />}>
            <AvatarList />
          </Suspense>
        </QueryErrorBoundary>
      </VStack>
      <Slot />
    </StyledSafeAreaView>
  );
}

function AvatarList() {
  const { t } = useTranslation('todo');
  const { friendId, date } = useGlobalSearchParams<{ friendId?: string; date?: string }>();
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
      <AvatarList.Item
        name={t('feed.me')}
        image={user.profileImage}
        isSelected={selectedFriendId === null}
        onPress={() => router.replace({ pathname: '/feed', params: date ? { date } : undefined })}
      />

      {friends.map((friend) => (
        <AvatarList.Item
          key={friend.followId}
          name={friend.displayName}
          image={friend.profileImage}
          isSelected={selectedFriendId === friend.id}
          onPress={() =>
            router.replace({
              pathname: '/feed/friend/[friendId]',
              params: { friendId: friend.id, ...(date ? { date } : {}) },
            })
          }
        />
      ))}

      <AvatarList.AddButton onPress={() => router.push('/friends/search')} />
    </ScrollView>
  );
}

AvatarList.Loading = function Loading() {
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
        <Avatar size="sm" alt={t('feed.avatarAlt', { name })}>
          <Avatar.Image source={getProfileIconSource(image)} />
        </Avatar>
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
