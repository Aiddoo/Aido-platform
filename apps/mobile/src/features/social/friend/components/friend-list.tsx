import catHiImage from '@assets/images/ido_cat_hi.webp';
import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { UserReportPolicy } from '@src/features/social/moderation/domains/user-report.model';
import type { BlockTarget } from '@src/features/social/moderation/schemas/user-block.schema';
import { ANIMATION } from '@src/shared/constants/animation';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useReorderableList } from '@src/shared/hooks/use-reorderable-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useSystemFontScaledSize } from '@src/shared/hooks/use-system-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  BlockIcon,
  FlagIcon,
  MenuActionItem,
  Button,
  DocsIcon,
  HintPopoverContent,
  InfiniteListFooter,
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
  useFetchNextPage,
  useOverlay,
  IconButton,
  Image,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Menu, Popover, PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
} from 'react-native-reanimated';
import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { useFriendListEditMode } from '../hooks/use-friend-list-edit-mode';
import {
  useRemoveFriendMutationOptions,
  useReorderFriendMutationOptions,
} from '../queries/friend.mutations';
import { useGetFriendsInfiniteQueryOptions } from '../queries/friend.queries';
import type { FriendUser } from '../schemas/friend.schema';
import { FriendDeleteConfirmDialog } from './friend-delete-confirm-dialog';
import { UserList } from './user-list';

interface FriendListInvite {
  /** 초대받은 사람이 받는 프리미엄 일수. 빈 목록 안내 문구에 쓴다 */
  welcomeDays: number;
  open: () => void;
}

interface FriendListProps {
  /** 초대를 쓸 수 있으면 빈 목록에서 링크로 데려오는 길을 먼저 보인다. 없으면 태그 찾기만 안내한다 */
  invite?: FriendListInvite;
}

export function FriendList({ invite }: FriendListProps) {
  const { t } = useTranslation('friend');
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch,
    dataUpdatedAt,
  } = useSuspenseInfiniteQuery(useGetFriendsInfiniteQueryOptions());
  const { fetchOnEndReached, retry } = useFetchNextPage({
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  });
  const reorderMutation = useMutation(useReorderFriendMutationOptions());
  const [isRefreshing, handleRefresh] = useRefresh(refetch);
  const { color: refreshTint } = useResolveClassNames('text-main');

  const { items: friends, totalCount } = data;

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
      ListEmptyComponent={<FriendList.Empty invite={invite} />}
      ListFooterComponent={
        <InfiniteListFooter
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          onRetry={retry}
        />
      }
      onEndReached={fetchOnEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
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
  friend: FriendUser;
}

FriendList.Item = function Item({ friend }: FriendListItemProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const fontScaledSize = useSystemFontScaledSize();
  const { t } = useTranslation(['common', 'friend']);
  const displayName = friend.name ?? t('friend:fallbackName');
  const [isEditMode] = useFriendListEditMode();
  const removeMutation = useMutation(useRemoveFriendMutationOptions());
  const overlay = useOverlay();

  const openDeleteConfirmDialog = () => {
    overlay.open(({ isOpen, close, unmount }) => {
      const closeDialog = () => {
        close();
        unmount();
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
                alt={displayName}
                className="size-10"
                profileImage={friend.profileImage}
              />
            }
            contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
            right={match({ isEditMode, isActive })
              .with({ isEditMode: false }, () => (
                <FriendModerationMenu userId={friend.id} displayName={displayName} />
              ))
              .with({ isEditMode: true, isActive: false }, () => (
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
              ))
              .with({ isEditMode: true, isActive: true }, () => null)
              .exhaustive()}
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
          <MenuActionItem
            icon={FlagIcon}
            title={t('menu.report')}
            onPress={() => {
              const target = UserReportPolicy.createProfileReportTarget({ userId });
              push({
                pathname: '/users/[userId]/report',
                params: { userId, name: displayName, targetType: target.targetType },
              });
            }}
          />
          <MenuActionItem
            icon={BlockIcon}
            title={t('block.action')}
            variant="danger"
            onPress={() =>
              push({ pathname: '/users/[userId]/block', params: { userId, name: displayName } })
            }
          />
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

FriendList.Loading = function Loading() {
  const fontScaledSize = useSystemFontScaledSize();
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

FriendList.Empty = function Empty({ invite }: FriendListProps) {
  const { t } = useTranslation(['friend', 'invite']);
  const push = useSingleTap(router.push);

  // 초대를 쓸 수 있으면 링크로 데려오는 길을 먼저, 태그 찾기를 다음으로 보여 준다
  if (invite != null) {
    return (
      <UserList.Empty
        icon={
          <Image
            source={catHiImage}
            accessibilityIgnoresInvertColors
            className="size-[120px]"
            contentFit="contain"
          />
        }
        title={t('invite:entry.friendsEmptyTitle')}
        description={t('invite:entry.friendsEmptyDescription', {
          days: invite.welcomeDays,
        })}
        button={
          <VStack align="center" gap={4}>
            <Result.Button testID="friends-empty-invite" color="primary" onPress={invite.open}>
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
  const fontScaledSize = useSystemFontScaledSize();
  const { t } = useTranslation(['friend', 'common']);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <IconButton
          accessibilityLabel={t('friend:list.editHintLabel')}
          icon={
            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-5"
            />
          }
          className="min-h-0 min-w-0"
          hitSlop={8}
          onPress={() => setIsOpen(true)}
        />
      </Popover.Trigger>
      <HintPopoverContent placement="bottom" description={t('list.editHint')} />
    </Popover>
  );
}
