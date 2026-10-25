import catHiImage from '@assets/images/ido_cat_hi.webp';
import { InviteRewardPolicy } from '@src/features/invite/domains/invite-reward.model';
import { useInviteAvailability } from '@src/features/invite/hooks/use-invite-availability';
import { useOpenMyInvite } from '@src/features/invite/hooks/use-open-my-invite';
import type { BlockTarget } from '@src/features/moderation/domains/user-block.model';
import { UserReportPolicy } from '@src/features/moderation/domains/user-report.model';
import {
  blockUserConfirmHref,
  userReportSheetHref,
} from '@src/features/moderation/utils/navigation/moderation-href';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useReorderableList } from '@src/shared/hooks/use-reorderable-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  DocsIcon,
  Flex,
  HStack,
  InfoIcon,
  ListRow,
  MenuIcon,
  MoreIcon,
  Result,
  Text,
  TextButton,
  TextSkeleton,
  VStack,
  useOverlay,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Menu, Popover, PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';
import { ActivityIndicator, Image, RefreshControl } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
} from 'react-native-reanimated';
import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { useResolveClassNames } from 'uniwind';

import { useFriendListEditMode } from '../hooks/use-friend-list-edit-mode';
import { useGetFriendsInfiniteQueryOptions } from '../queries/get-friends-infinite-query-options';
import { useRemoveFriendMutationOptions } from '../queries/use-remove-friend-mutation-options';
import { useReorderFriendMutationOptions } from '../queries/use-reorder-friend-mutation-options';
import type { FriendUserViewModel } from '../utils/view-models/friend-user.view-model';
import { FriendDeleteConfirmDialog } from './friend-delete-confirm-dialog';
import { UserList } from './user-list';

export function FriendList() {
  const { t } = useTranslation('friend');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, dataUpdatedAt } =
    useSuspenseInfiniteQuery(useGetFriendsInfiniteQueryOptions());
  const reorderMutation = useMutation(useReorderFriendMutationOptions());
  const [refreshing, onRefresh] = useRefresh(refetch);
  const { color: refreshTint } = useResolveClassNames('text-main');

  const friends = data.pages.flatMap((page) => page.items);
  const totalCount = data.pages[0]?.totalCount ?? 0;

  const reorderableList = useReorderableList({
    items: friends,
    updatedAt: dataUpdatedAt,
    isPending: reorderMutation.isPending,
    getItemId: (friend) => friend.followId,
    onReorder: ({ instruction: { movedId, targetId: targetFollowId, position } }) => {
      reorderMutation.mutate({
        followId: movedId,
        input: { targetFollowId, position },
      });
    },
  });

  return (
    <ReorderableList
      {...reorderableList}
      shouldUpdateActiveItem
      keyExtractor={(item) => item.followId}
      ListHeaderComponent={
        <HStack py={12} align="center" justify="between">
          <Text size="b4" shade={6}>
            {t('list.friendCount', { count: totalCount })}
          </Text>
          <EditModeGuideTooltip />
        </HStack>
      }
      renderItem={({ item }) => <FriendList.Item friend={item} />}
      ListEmptyComponent={<FriendList.Empty />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <Flex py={16} align="center">
            <ActivityIndicator />
          </Flex>
        ) : undefined
      }
      onEndReached={() => {
        if (hasNextPage) {
          return fetchNextPage({ cancelRefetch: false });
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={refreshTint}
          colors={refreshTint == null ? undefined : [refreshTint]}
        />
      }
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
    />
  );
}

interface FriendListItemProps {
  friend: FriendUserViewModel;
}

FriendList.Item = function Item({ friend }: FriendListItemProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('common');
  const [isEditMode] = useFriendListEditMode();
  const removeMutation = useMutation(useRemoveFriendMutationOptions());
  const overlay = useOverlay();

  const openDeleteConfirmDialog = () => {
    overlay.open(({ isOpen, close, exit }) => {
      const closeDialog = () => {
        close();
        exit();
      };
      return (
        <FriendDeleteConfirmDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeDialog();
            }
          }}
          onCancel={closeDialog}
          onConfirm={() => {
            closeDialog();
            removeMutation.mutate(friend.id);
          }}
        />
      );
    });
  };

  return (
    <PressableFeedback
      onLongPress={isEditMode ? drag : undefined}
      isDisabled={isActive}
      className={cn(isActive && 'bg-gray-1 rounded-xl')}
    >
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
            left={
              <UserAvatar
                alt={friend.displayName}
                className="size-10"
                profileImage={friend.profileImage}
              />
            }
            contents={<ListRow.Texts type="1RowTypeA" top={friend.displayName} />}
            right={
              !isEditMode ? (
                <FriendModerationMenu userId={friend.id} displayName={friend.displayName} />
              ) : !isActive ? (
                <Animated.View
                  entering={FadeInRight.duration(ANIMATION.duration.normal)}
                  exiting={FadeOutRight.duration(ANIMATION.duration.fast)}
                >
                  <Button
                    testID="friend-delete"
                    variant="weak"
                    color="danger"
                    size="small"
                    display="inline"
                    onPress={openDeleteConfirmDialog}
                    isDisabled={removeMutation.isPending}
                  >
                    {t('actions.delete')}
                  </Button>
                </Animated.View>
              ) : null
            }
          />
        </Animated.View>
      </HStack>
    </PressableFeedback>
  );
};

/** 친구 행의 ⋯ 메뉴. 편집 중이 아닐 때 프로필을 신고하거나 친구를 차단한다 */
function FriendModerationMenu({ userId, displayName }: BlockTarget) {
  const { t } = useTranslation('moderation');
  const push = useSingleTap(router.push);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          hitSlop={8}
          className="size-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel={t('menu.moreFor', { name: displayName })}
          accessibilityState={{ expanded: isOpen }}
        >
          <MoreIcon width={18} height={18} colorClassName="text-gray-6" />
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={180}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          <Menu.Item
            onPress={() =>
              push(
                userReportSheetHref({
                  target: UserReportPolicy.profileTarget({ userId }),
                  displayName,
                }),
              )
            }
          >
            <Menu.ItemTitle>{t('menu.report')}</Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item
            variant="danger"
            onPress={() => push(blockUserConfirmHref({ userId, displayName }))}
          >
            <Menu.ItemTitle>{t('block.action')}</Menu.ItemTitle>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

FriendList.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();
  const infoIconSize = fontScaledSize(16);
  return (
    <UserList.Loading
      ListHeaderComponent={
        <HStack py={12} align="center" justify="between">
          <TextSkeleton size="b4" className="w-16" />
          <Skeleton
            className="rounded-full"
            style={{ width: infoIconSize, height: infoIconSize }}
          />
        </HStack>
      }
    />
  );
};

FriendList.Error = UserList.Error;

FriendList.Empty = function Empty() {
  const { t } = useTranslation(['friend', 'invite']);
  const push = useSingleTap(router.push);
  const openMyInvite = useOpenMyInvite();
  const isInviteAvailable = useInviteAvailability();

  // 초대를 쓸 수 있으면 링크로 데려오는 길을 먼저, 태그 찾기를 다음으로 보여 준다
  if (isInviteAvailable) {
    return (
      <UserList.Empty
        icon={
          <Image
            source={catHiImage}
            accessibilityIgnoresInvertColors
            className="size-[120px]"
            resizeMode="contain"
          />
        }
        title={t('invite:entry.friendsEmptyTitle')}
        description={t('invite:entry.friendsEmptyDescription', {
          days: InviteRewardPolicy.welcomePremiumDays(),
        })}
        button={
          <VStack align="center" gap={4}>
            <Result.Button
              testID="friends-empty-invite"
              color="primary"
              onPress={() => openMyInvite('friends_empty')}
            >
              {t('invite:entry.inviteFriends')}
            </Result.Button>
            <TextButton size="small" variant="underline" onPress={() => push('/friends/add')}>
              {t('invite:entry.findByTag')}
            </TextButton>
          </VStack>
        }
      />
    );
  }

  return (
    <UserList.Empty
      icon={<DocsIcon width={72} height={72} />}
      title={t('list.emptyTitle')}
      description={t('list.emptyDescription')}
    />
  );
};

function EditModeGuideTooltip() {
  const fontScaledSize = useFontScaledSize();
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
