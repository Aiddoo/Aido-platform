import { getMeQueryOptions } from '@src/features/auth/presentations/queries/get-me-query-options';
import { getFriendsQueryOptions } from '@src/features/friend/presentations/queries/get-friends-query-options';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Avatar, PressableFeedback, Skeleton } from 'heroui-native';
import { useMemo } from 'react';
import { Image, ScrollView } from 'react-native';

const UserAvatarListComponent = () => {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const {
    data: friendsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(getFriendsQueryOptions());

  const friends = useMemo(
    () => friendsData.pages.flatMap((page) => page.friends),
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
      <UserAvatarItem name="나" profileImage={user.profileImage} isSelected={true} />

      {friends.map((friend) => (
        <UserAvatarItem
          key={friend.followId}
          name={friend.name ?? '친구'}
          profileImage={friend.profileImage}
        />
      ))}
    </ScrollView>
  );
};

const UserAvatarListLoading = () => {
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

export const UserAvatarList = Object.assign(UserAvatarListComponent, {
  Loading: UserAvatarListLoading,
});

interface UserAvatarItemProps {
  name: string;
  profileImage?: string | null;
  isSelected?: boolean;
  onPress?: () => void;
}

const UserAvatarItem = ({ name, profileImage, isSelected, onPress }: UserAvatarItemProps) => {
  return (
    <PressableFeedback onPress={onPress}>
      <VStack align="center" gap={4}>
        <Avatar size="sm" alt={`${name} 프로필`}>
          {profileImage ? (
            <Avatar.Image source={{ uri: profileImage }} />
          ) : (
            <Image source={require('@assets/images/icon.png')} className="size-full" />
          )}
        </Avatar>
        <Text size="e1" shade={isSelected ? 9 : 6} weight={isSelected ? 'semibold' : 'normal'}>
          {name}
        </Text>
      </VStack>
    </PressableFeedback>
  );
};
