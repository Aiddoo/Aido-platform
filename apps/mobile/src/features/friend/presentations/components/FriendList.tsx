import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import {
  Box,
  Button,
  DocsIcon,
  Flex,
  HStack,
  ListRow,
  Result,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Avatar, PressableFeedback, Skeleton } from 'heroui-native';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useDraggableFriendReorderList } from '../hooks/use-draggable-friend-reorder-list';
import { useGetFriendsQueryOptions } from '../queries/use-get-friends-query-options';
import { useRemoveFriendMutationOptions } from '../queries/use-remove-friend-mutation-options';
import { useReorderFriendMutationOptions } from '../queries/use-reorder-friend-mutation-options';
import type { FriendUserViewModel } from '../view-models/friend-user.view-model';
import { FriendDeleteConfirmDialog } from './FriendDeleteConfirmDialog';

export function FriendList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, dataUpdatedAt } =
    useSuspenseInfiniteQuery(useGetFriendsQueryOptions());
  const removeMutation = useMutation(useRemoveFriendMutationOptions());
  const reorderMutation = useMutation(useReorderFriendMutationOptions());
  const overlay = useOverlay();
  const [isRefreshing, handleRefresh] = useRefresh(refetch);

  const allFriends = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  const { items: draggableFriends, onDragEnd } = useDraggableFriendReorderList({
    items: allFriends,
    updatedAt: dataUpdatedAt,
    isPending: reorderMutation.isPending,
    onReorder: ({ movedFollowId, targetFollowId, position }) => {
      reorderMutation.mutate({
        followId: movedFollowId,
        input: { targetFollowId, position },
      });
    },
  });

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
    <DraggableFlatList
      data={draggableFriends}
      keyExtractor={(item) => item.followId}
      activationDistance={10}
      ListHeaderComponent={
        <Box py={12}>
          <Text size="b4" shade={6}>
            총 {totalCount}명
          </Text>
        </Box>
      }
      renderItem={({
        item,
        drag,
        isActive,
      }: {
        item: FriendUserViewModel;
        drag: () => void;
        isActive: boolean;
      }) => {
        const isProcessing = removeMutation.isPending && removeMutation.variables === item.id;
        const displayName = item.displayName;

        return (
          <ScaleDecorator activeScale={1.015}>
            <PressableFeedback
              onLongPress={reorderMutation.isPending ? undefined : drag}
              isDisabled={isActive}
              className={cn(isActive && 'bg-gray-1 rounded-xl')}
            >
              <ListRow
                horizontalPadding="none"
                left={
                  <Avatar alt={displayName} className="size-10">
                    <Avatar.Image source={getProfileIconSource(item.profileImage)} />
                  </Avatar>
                }
                contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
                right={
                  !isActive && (
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
                  )
                }
              />
            </PressableFeedback>
          </ScaleDecorator>
        );
      }}
      onDragEnd={onDragEnd}
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
      containerStyle={{ flex: 1 }}
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
