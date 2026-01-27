import { FlashList } from '@shopify/flash-list';
import { Box } from '@src/shared/ui/Box/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DocsIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { Result } from '@src/shared/ui/Result/Result';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Avatar, Skeleton } from 'heroui-native';
import { ActivityIndicator, ScrollView } from 'react-native';
import type { FriendUser } from '../../models/friend.model';
import { getFriendsQueryOptions } from '../queries/get-friends-query-options';
import { removeFriendMutationOptions } from '../queries/remove-friend-mutation-options';

const FriendListComponent = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    getFriendsQueryOptions(),
  );
  const removeMutation = useMutation(removeFriendMutationOptions());

  const allFriends = data.pages.flatMap((page) => page.friends);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  return (
    <FlashList
      ListHeaderComponent={
        <Box py={12}>
          <Text size="b4" shade={6}>
            총 {totalCount}명
          </Text>
        </Box>
      }
      data={allFriends}
      renderItem={({ item }: { item: FriendUser }) => {
        const isProcessing = removeMutation.isPending && removeMutation.variables === item.id;
        const displayName = item.name ?? item.userTag;

        return (
          <ListRow
            horizontalPadding="none"
            left={
              <Avatar alt={displayName} className="size-10">
                {item.profileImage && <Avatar.Image source={{ uri: item.profileImage }} />}
                <Avatar.Fallback>
                  <Avatar.Image source={require('@assets/images/icon.png')} />
                </Avatar.Fallback>
              </Avatar>
            }
            contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
            right={
              <Button
                variant="weak"
                color="danger"
                size="small"
                display="inline"
                onPress={() => removeMutation.mutate(item.id)}
                disabled={isProcessing}
              >
                삭제
              </Button>
            }
          />
        );
      }}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          <Result icon={<DocsIcon width={72} height={72} />} title="아직 친구가 없어요" />
        </Flex>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <Flex py={16} align="center">
            <ActivityIndicator />
          </Flex>
        ) : null
      }
      keyExtractor={(item) => item.followId}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    />
  );
};

const FriendListLoading = () => (
  <ScrollView className="flex-1 px-4">
    <Box py={12}>
      <Skeleton className="w-12 h-4" />
    </Box>
    <VStack>
      {times(3, (i) => (
        <HStack key={i} align="center" className="py-2" gap={12}>
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="flex-1 h-5" />
          <Skeleton className="w-12 h-8 rounded" />
        </HStack>
      ))}
    </VStack>
  </ScrollView>
);

export const FriendList = Object.assign(FriendListComponent, {
  Loading: FriendListLoading,
});
