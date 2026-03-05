import { FlashList } from '@shopify/flash-list';
import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { Box } from '@src/shared/ui/Box/Box';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { DocsIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Result } from '@src/shared/ui/Result/Result';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Avatar, Skeleton } from 'heroui-native';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { getFriendsQueryOptions } from '../queries/get-friends-query-options';
import { removeFriendMutationOptions } from '../queries/remove-friend-mutation-options';
import type { FriendUserViewModel } from '../view-models/friend-user.view-model';
import { FriendDeleteConfirmDialog } from './FriendDeleteConfirmDialog';

export function FriendList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useSuspenseInfiniteQuery(getFriendsQueryOptions());
  const removeMutation = useMutation(removeFriendMutationOptions());
  const overlay = useOverlay();
  const [isRefreshing, handleRefresh] = useRefresh(refetch);

  const allFriends = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  const openDeleteConfirmDialog = (id: string) => {
    overlay.open(({ isOpen, close, exit }) => {
      const closeDialog = () => {
        close();
        exit();
      };
      const isProcessing = removeMutation.isPending && removeMutation.variables === id;

      return (
        <FriendDeleteConfirmDialog
          isOpen={isOpen}
          isProcessing={isProcessing}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          onCancel={closeDialog}
          onConfirm={() => {
            closeDialog();
            removeMutation.mutate(id);
          }}
        />
      );
    });
  };

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
      renderItem={({ item }: { item: FriendUserViewModel }) => {
        const isProcessing = removeMutation.isPending && removeMutation.variables === item.id;
        const displayName = item.displayName;

        return (
          <ListRow
            horizontalPadding="none"
            left={
              <Avatar alt={displayName} className="size-10">
                <Avatar.Image source={getProfileIconSource(item.profileImage)} />
              </Avatar>
            }
            contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
            right={
              <Button
                variant="weak"
                color="danger"
                size="small"
                display="inline"
                onPress={() => openDeleteConfirmDialog(item.id)}
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
          <Result
            icon={<DocsIcon width={72} height={72} />}
            title="친구를 추가해 보세요"
            description="검색 아이콘을 눌러 친구를 찾을 수 있어요"
          />
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
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#FF6B43"
          colors={['#FF6B43']}
        />
      }
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    />
  );
}

FriendList.Loading = function Loading() {
  return (
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
};
