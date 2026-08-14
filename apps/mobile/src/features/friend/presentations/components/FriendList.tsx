import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DocsIcon,
  Flex,
  HStack,
  InfoIcon,
  ListRow,
  MenuIcon,
  Result,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { Avatar, Popover, PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
} from 'react-native-reanimated';

import { useDraggableFriendReorderList } from '../hooks/use-draggable-friend-reorder-list';
import { useFriendListEditMode } from '../hooks/use-friend-list-edit-mode';
import { useGetFriendsQueryOptions } from '../queries/use-get-friends-query-options';
import { useRemoveFriendMutationOptions } from '../queries/use-remove-friend-mutation-options';
import { useReorderFriendMutationOptions } from '../queries/use-reorder-friend-mutation-options';
import type { FriendUserViewModel } from '../view-models/friend-user.view-model';
import { FriendDeleteConfirmDialog } from './FriendDeleteConfirmDialog';

export function FriendList() {
  const { t } = useTranslation(['friend', 'common']);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, dataUpdatedAt } =
    useSuspenseInfiniteQuery(useGetFriendsQueryOptions());

  const removeMutation = useMutation(useRemoveFriendMutationOptions());
  const reorderMutation = useMutation(useReorderFriendMutationOptions());

  const overlay = useOverlay();
  const [isRefreshing, handleRefresh] = useRefresh(refetch);
  const [isEditMode] = useFriendListEditMode();

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
            if (!open) {
              closeDialog();
            }
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
        <HStack py={12} align="center" justify="between">
          <Text size="b4" shade={6}>
            {t('list.friendCount', { count: totalCount })}
          </Text>
          <EditModeGuideTooltip />
        </HStack>
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
          <ScaleDecorator activeScale={isEditMode ? 1.015 : 1}>
            <PressableFeedback
              onLongPress={isEditMode && !reorderMutation.isPending ? drag : undefined}
              isDisabled={isActive}
              className={cn(isActive && 'bg-gray-1 rounded-xl')}
            >
              <Animated.View layout={LinearTransition.duration(ANIMATION.duration.normal)}>
                <HStack align="center">
                  {isEditMode && (
                    <Animated.View
                      entering={FadeInLeft.duration(ANIMATION.duration.normal)}
                      exiting={FadeOutLeft.duration(ANIMATION.duration.fast)}
                      className="pr-3 justify-center"
                    >
                      <MenuIcon
                        width={fontScaledSize(18)}
                        height={fontScaledSize(18)}
                        colorClassName="text-gray-5"
                      />
                    </Animated.View>
                  )}
                  <Animated.View
                    className="flex-1"
                    layout={LinearTransition.duration(ANIMATION.duration.normal)}
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
                        isEditMode && !isActive ? (
                          <Animated.View
                            entering={FadeInRight.duration(ANIMATION.duration.normal)}
                            exiting={FadeOutRight.duration(ANIMATION.duration.fast)}
                          >
                            <Button
                              variant="weak"
                              color="danger"
                              size="small"
                              display="inline"
                              onPress={() => openDeleteConfirmDialog(item.id)}
                              disabled={isProcessing}
                            >
                              {t('common:actions.delete')}
                            </Button>
                          </Animated.View>
                        ) : null
                      }
                    />
                  </Animated.View>
                </HStack>
              </Animated.View>
            </PressableFeedback>
          </ScaleDecorator>
        );
      }}
      onDragEnd={onDragEnd}
      ListEmptyComponent={
        <Flex flex={1} justify="center" align="center">
          <Result
            icon={<DocsIcon width={72} height={72} />}
            title={t('list.emptyTitle')}
            description={t('list.emptyDescription')}
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
          </HStack>
        ))}
      </VStack>
    </ScrollView>
  );
};

function EditModeGuideTooltip() {
  const { t } = useTranslation(['friend', 'common']);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback onPress={() => setIsOpen(true)} className="items-center justify-center">
          <InfoIcon
            width={fontScaledSize(16)}
            height={fontScaledSize(16)}
            colorClassName="text-gray-5"
          />
        </PressableFeedback>
      </Popover.Trigger>
      <Popover.Portal disableFullWindowOverlay={false}>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement="bottom"
          align="end"
          avoidCollisions={false}
          className="rounded-2xl border border-border px-4 py-3"
        >
          <Popover.Arrow />
          <Text size="b4" shade={6}>
            {t('list.editHint')}
          </Text>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
