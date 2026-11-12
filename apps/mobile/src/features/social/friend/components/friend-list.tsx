import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { UserList } from '@src/features/identity/user/components/user-list';
import type { BlockTarget } from '@src/features/social/moderation/domains/user-block.model';
import { createProfileReportTarget } from '@src/features/social/moderation/domains/user-report.model';
import { ANIMATION } from '@src/shared/constants/animation';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useReorderableList } from '@src/shared/hooks/use-reorderable-list';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BlockIcon,
  Button,
  FlagIcon,
  FriendIllustration,
  HintPopoverContent,
  HStack,
  IconButton,
  InfiniteListFooter,
  InfoIcon,
  ListRow,
  MenuActionItem,
  MenuIcon,
  MoreIcon,
  Result,
  Text,
  TextButton,
  TextSkeleton,
  TintedRefreshControl,
  useFetchNextPage,
  useConfirmDialog,
  VStack,
  MenuContent,
  Mascot,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Menu, Popover, PressableFeedback, Skeleton } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
} from 'react-native-reanimated';
import ReorderableList, { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { match } from 'ts-pattern';

import type { FriendUser } from '../domains/friend.model';
import { useFriendListIsEditing } from '../hooks/use-friend-list-params';
import { refreshFriends } from '../queries/friend-cache';
import {
  useRemoveFriendMutationOptions,
  useReorderFriendMutationOptions,
} from '../queries/friend.mutations';
import { useGetFriendsInfiniteQueryOptions } from '../queries/friend.queries';

interface FriendListProps {
  /** 초대를 쓸 수 있으면 빈 목록에서 링크로 데려오는 길을 먼저 보인다. 없으면 태그 찾기만 안내한다 */
  onInvite?: () => void;
  /** 초대받은 사람이 받는 프리미엄 일수. 빈 목록 안내 문구에 쓴다 */
  inviteWelcomeDays?: number;
}

export function FriendList({ onInvite, inviteWelcomeDays }: FriendListProps) {
  const { t } = useTranslation('friend');
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    dataUpdatedAt,
  } = useSuspenseInfiniteQuery(useGetFriendsInfiniteQueryOptions());
  const { fetchOnEndReached, retry } = useFetchNextPage({
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  });
  const reorderMutation = useMutation(useReorderFriendMutationOptions());
  const [isEditing] = useFriendListIsEditing();
  const queryClient = useQueryClient();
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshFriends(queryClient));

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
      extraData={isEditing}
      renderItem={({ item }) => <FriendList.Item friend={item} isEditing={isEditing} />}
      ListEmptyComponent={
        <FriendList.Empty onInvite={onInvite} inviteWelcomeDays={inviteWelcomeDays} />
      }
      ListFooterComponent={
        <InfiniteListFooter
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          onRetry={retry}
        />
      }
      onEndReached={fetchOnEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={<TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
    />
  );
}

interface FriendListItemProps {
  friend: FriendUser;
  isEditing: boolean;
}

FriendList.Item = function Item({ friend, isEditing }: FriendListItemProps) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation(['common', 'friend']);
  const displayName = friend.name ?? t('friend:fallbackName');
  const removeMutation = useMutation(useRemoveFriendMutationOptions());
  const confirmDialog = useConfirmDialog();

  const openDeleteConfirmDialog = async () => {
    const isConfirmed = await confirmDialog.openAsync({
      title: t('friend:deleteDialog.title', { name: displayName }),
      description: t('friend:deleteDialog.description'),
      confirmLabel: t('common:actions.delete'),
      confirmColor: 'danger',
      confirmTestID: 'friend-delete-confirm',
      cancelLabel: t('common:actions.cancel'),
    });
    // 낙관적 갱신이 행을 바로 지우므로 다이얼로그를 연 채 기다리지 않는다
    if (isConfirmed) {
      removeMutation.mutate(friend.id);
    }
  };

  // 행 모양을 편집과 상관없이 고정해 편집을 켜고 끌 때 손잡이·내용·삭제 버튼이 미끄러지고 사라지게 둔다.
  // 끌기는 바깥 행이, 평소 누름은 안쪽 Link가 받는다. 편집 중이 아니면 바깥은 Link를 스크린리더에서 가리지 않는다
  return (
    <PressableFeedback
      onLongPress={isEditing ? drag : undefined}
      isDisabled={isActive}
      accessible={isEditing}
      className={cn(isActive && 'bg-gray-1 rounded-xl')}
    >
      <HStack align="center">
        {isEditing && (
          <Animated.View
            entering={FadeInLeft.duration(ANIMATION.durationMs.normal)}
            exiting={FadeOutLeft.duration(ANIMATION.durationMs.fast)}
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
          layout={LinearTransition.duration(ANIMATION.durationMs.normal)}
        >
          <FriendList.Link friendId={friend.id} displayName={displayName} isEditing={isEditing}>
            <ListRow
              left={
                <UserAvatar
                  alt={displayName}
                  className="size-10"
                  profileImage={friend.profileImage}
                />
              }
              contents={<ListRow.Texts type="1RowTypeA" top={displayName} />}
              right={match({ isEditing, isActive })
                .with({ isEditing: false }, () => (
                  <FriendModerationMenu userId={friend.id} displayName={displayName} />
                ))
                .with({ isEditing: true, isActive: false }, () => (
                  <Animated.View
                    entering={FadeInRight.duration(ANIMATION.durationMs.normal)}
                    exiting={FadeOutRight.duration(ANIMATION.durationMs.fast)}
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
                .with({ isEditing: true, isActive: true }, () => null)
                .exhaustive()}
            />
          </FriendList.Link>
        </Animated.View>
      </HStack>
    </PressableFeedback>
  );
};

interface FriendListLinkProps {
  friendId: string;
  displayName: string;
  isEditing: boolean;
  children: ReactNode;
}

/**
 * 누르면 그 친구의 피드로 간다. 피드는 다른 탭이라 미리보기는 붙이지 않고(state-and-routing Link 규칙)
 * 길게 누르면 메뉴만 연다(iOS). 다른 플랫폼은 행의 ⋯ 메뉴가 같은 동작을 맡는다.
 * 편집 중에는 누름을 받지 않아 바깥 행이 길게 눌러 끌기를 받고, 끌기와 겹치는 메뉴도 붙이지 않는다
 */
FriendList.Link = function FriendLink({
  friendId,
  displayName,
  isEditing,
  children,
}: FriendListLinkProps) {
  const { t } = useTranslation(['friend', 'todo', 'moderation']);
  // Link가 navigate로 열어 같은 화면은 한 번만 쌓인다. 메뉴도 같은 동사여야 겹쳐 쌓이지 않는다
  const navigate = useSingleTap(router.navigate);
  const push = useSingleTap(router.push);
  const href = { pathname: '/feed', params: { friendId } } as const;

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <PressableFeedback isDisabled={isEditing}>{children}</PressableFeedback>
      </Link.Trigger>
      {!isEditing && (
        <Link.Menu>
          <Link.MenuAction icon="person.2" onPress={() => navigate(href)}>
            {t('friend:list.openFeed')}
          </Link.MenuAction>
          <Link.MenuAction
            icon="hand.point.up.left"
            onPress={() =>
              push({
                pathname: '/users/[userId]/nudge',
                params: { userId: friendId, name: displayName },
              })
            }
          >
            {t('todo:friendTodo.nudge')}
          </Link.MenuAction>
          <Link.MenuAction
            icon="flag"
            onPress={() => {
              const target = createProfileReportTarget({ userId: friendId });
              push({
                pathname: '/users/[userId]/report',
                params: { userId: friendId, name: displayName, targetType: target.targetType },
              });
            }}
          >
            {t('moderation:menu.report')}
          </Link.MenuAction>
          <Link.MenuAction
            icon="nosign"
            destructive
            onPress={() =>
              push({
                pathname: '/users/[userId]/block',
                params: { userId: friendId, name: displayName },
              })
            }
          >
            {t('moderation:block.action')}
          </Link.MenuAction>
        </Link.Menu>
      )}
    </Link>
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
      <MenuContent width={180}>
        <MenuActionItem
          Icon={FlagIcon}
          title={t('menu.report')}
          onPress={() => {
            const target = createProfileReportTarget({ userId });
            push({
              pathname: '/users/[userId]/report',
              params: { userId, name: displayName, targetType: target.targetType },
            });
          }}
        />
        <MenuActionItem
          Icon={BlockIcon}
          title={t('block.action')}
          variant="danger"
          onPress={() =>
            push({ pathname: '/users/[userId]/block', params: { userId, name: displayName } })
          }
        />
      </MenuContent>
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

FriendList.Empty = function Empty({ onInvite, inviteWelcomeDays }: FriendListProps) {
  const { t } = useTranslation(['friend', 'invite']);
  const push = useSingleTap(router.push);

  // 초대를 쓸 수 있으면 링크로 데려오는 길을 먼저, 태그 찾기를 다음으로 보여 준다
  if (onInvite != null) {
    return (
      <UserList.Empty
        icon={<Mascot name="catHi" size={120} isCentered />}
        title={t('invite:entry.friendsEmptyTitle')}
        description={t('invite:entry.friendsEmptyDescription', {
          days: inviteWelcomeDays,
        })}
        button={
          <VStack align="center" gap={4}>
            <Result.Button testID="friends-empty-invite" color="primary" onPress={onInvite}>
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
      icon={<FriendIllustration />}
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
