import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useGetFriendsInfiniteQueryOptions } from '@src/features/friend/queries/get-friends-infinite-query-options';
import type { FriendUserViewModel } from '@src/features/friend/utils/view-models/friend-user.view-model';
import { useInviteAvailability } from '@src/features/invite/hooks/use-invite-availability';
import { useOpenMyInvite } from '@src/features/invite/hooks/use-open-my-invite';
import { UserAvatar } from '@src/features/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  HStack,
  PlusIcon,
  RefreshIcon,
  Result,
  type QueryErrorFallbackProps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { TEXT_SIZE_CLASSES } from '@src/shared/ui/text/text.variants';
import { cn } from '@src/shared/utils/cn';
import { selectionFeedback } from '@src/shared/utils/haptics';
import {
  usePrefetchInfiniteQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { memo, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useResolveClassNames } from 'uniwind';

import { useFeedFriendIdParam } from '../hooks/use-feed-friend-id-param';
import { getFriendStripRevealOffset } from '../utils/friend-strip-scroll';

/** 아바타 40 + 양쪽 선택 링 2 + 링 안쪽 여백 2. 선택 여부와 관계없이 늘 같은 크기다 */
const AVATAR_FRAME_SIZE = 48;
const LABEL_GAP = 4;
const ITEM_GAP = 8;
const MIN_ITEM_WIDTH = 56;
/** 이름 칸은 글자 배율이 커져도 한글 네 글자 정도가 보이게 넓힌다 */
const LABEL_WIDTH_IN_EM = 4.5;
const DIVIDER_HEIGHT = 32;
const LOADING_ITEM_COUNT = 8;
/** 가로 목록이라 1은 목록 폭 한 번. 끝에서 두 화면 앞에서 다음 페이지를 미리 부른다 */
const END_REACHED_THRESHOLD = 2;
/** 빠르게 넘길 때 새 칸을 그 프레임에 그리지 않도록 앞뒤 600pt(친구 8명쯤)를 미리 그려 둔다 */
const DRAW_DISTANCE = 600;

/**
 * 피드 위에서 나와 친구를 골라 그 사람의 피드로 바꾸는 가로 친구 줄.
 * "나"는 왼쪽에 고정하고, 친구는 서버 순서(친구 목록 편집에서 정한 순서)대로 커서 페이지를 이어 붙인다.
 */
export function FriendStrip() {
  const { t } = useTranslation('todo');
  const listRef = useRef<FlashListRef<FriendUserViewModel>>(null);
  const [isListLoaded, setIsListLoaded] = useState(false);
  const { width, height } = useFriendStripItemSize();
  const friendsQueryOptions = useGetFriendsInfiniteQueryOptions();
  usePrefetchInfiniteQuery(friendsQueryOptions);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const {
    data: friendPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(friendsQueryOptions);

  const friends = friendPages.pages.flatMap((page) => page.items);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      fetchNextPage({ cancelRefetch: false }).catch(noop);
    }
  };

  return (
    <HStack align="start" style={{ height }}>
      <Box pl={16} pr={ITEM_GAP}>
        <FriendStrip.Item
          name={t('friendStrip.me')}
          profileImage={user.profileImage}
          width={width}
        />
      </Box>
      <Divider />
      {friends.length === 0 ? (
        <FriendStrip.Empty />
      ) : (
        <>
          <FlashList
            ref={listRef}
            horizontal
            data={friends}
            keyExtractor={(friend) => friend.followId}
            renderItem={({ item: friend }) => (
              <FriendStrip.Item
                friendId={friend.id}
                name={friend.displayName}
                profileImage={friend.profileImage}
                width={width}
              />
            )}
            ItemSeparatorComponent={ItemGap}
            ListFooterComponent={
              <ListEnd
                hasNextPage={hasNextPage}
                isFetchNextPageError={isFetchNextPageError}
                onRetry={() => fetchNextPage({ cancelRefetch: false }).catch(noop)}
              />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={END_REACHED_THRESHOLD}
            drawDistance={DRAW_DISTANCE}
            onLoad={() => setIsListLoaded(true)}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingRight: 16 }}
          />
          <SelectedFriendReveal listRef={listRef} friends={friends} isListLoaded={isListLoaded} />
        </>
      )}
    </HStack>
  );
}

interface FriendStripItemProps {
  /** 없으면 "나"다 */
  friendId?: string;
  name: string;
  profileImage: string | null;
  /** 칸 폭. 셀마다 글꼴 배율을 다시 읽지 않게 친구 줄이 한 번 정해 넘긴다 */
  width: number;
}

/** 원시 값만 받아 페이지가 붙거나 부모가 다시 그려져도 같은 친구 칸은 다시 그리지 않는다 */
FriendStrip.Item = memo(function Item({
  friendId,
  name,
  profileImage,
  width,
}: FriendStripItemProps) {
  const { t } = useTranslation('todo');
  const [selectedFriendId, setSelectedFriendId] = useFeedFriendIdParam();
  const isSelected = selectedFriendId === friendId;
  const selectFriend = useSingleTap((nextFriendId: string | undefined) => {
    selectionFeedback();
    setSelectedFriendId(nextFriendId);
  });

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={
        friendId == null ? t('friendStrip.meLabel') : t('friendStrip.friendLabel', { name })
      }
      accessibilityState={{ selected: isSelected }}
      testID={friendId == null ? 'friend-strip-me' : `friend-strip-item-${friendId}`}
      onPress={() => {
        if (isSelected) {
          return;
        }
        selectFriend(friendId);
      }}
    >
      <StripCell
        width={width}
        avatar={
          <AvatarFrame isSelected={isSelected}>
            <UserAvatar size="sm" alt={name} profileImage={profileImage} />
          </AvatarFrame>
        }
        label={
          <Text
            size="e1"
            shade={isSelected ? 9 : 6}
            weight={isSelected ? 'semibold' : 'normal'}
            align="center"
            maxLines={1}
            className="w-full"
          >
            {name}
          </Text>
        }
      />
    </PressableFeedback>
  );
});

FriendStrip.Loading = function Loading() {
  const { height } = useFriendStripItemSize();

  return (
    <HStack align="start" className="overflow-hidden" style={{ height }}>
      <Box pl={16} pr={ITEM_GAP}>
        <SkeletonCell />
      </Box>
      <Divider />
      <HStack gap={ITEM_GAP}>
        {times(LOADING_ITEM_COUNT, (index) => (
          <SkeletonCell key={index} />
        ))}
      </HStack>
    </HStack>
  );
};

FriendStrip.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['friend', 'common']);
  const { height } = useFriendStripItemSize();

  return (
    <HStack px={16} gap={8} align="center" style={{ height }}>
      <Text size="b4" shade={6} maxLines={2} className="flex-1">
        {t('friend:list.loadFailed')}
      </Text>
      <Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>
    </HStack>
  );
};

/** 친구가 없으면 "나" 옆에서 초대(초대를 못 쓰면 친구 찾기)로 이끈다. 칸 높이는 친구가 있을 때와 같다 */
FriendStrip.Empty = function Empty() {
  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);
  const openMyInvite = useOpenMyInvite();
  const isInviteAvailable = useInviteAvailability();
  const hint = isInviteAvailable
    ? t('friendStrip.emptyInviteHint')
    : t('friendStrip.emptySearchHint');

  return (
    <PressableFeedback
      testID="friend-strip-empty"
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={() => {
        if (isInviteAvailable) {
          openMyInvite('friend_strip_empty');
          return;
        }
        push('/friends/search');
      }}
      className="flex-1"
    >
      <HStack align="start" gap={12} pr={16}>
        <ActionCell
          icon={<PlusIcon width={16} height={16} colorClassName="text-gray-6" />}
          label={isInviteAvailable ? t('friendStrip.emptyInvite') : t('friendStrip.findFriends')}
        />
        <Box flex={1} className="justify-center" style={{ height: AVATAR_FRAME_SIZE }}>
          <Text size="b4" shade={6} maxLines={2}>
            {hint}
          </Text>
        </Box>
      </HStack>
    </PressableFeedback>
  );
};

/** 목록 끝 칸: 더 불러오는 중이면 스켈레톤, 실패하면 그 자리에서 다시 시도, 다 불렀으면 친구 찾기 */
function ListEnd({
  hasNextPage,
  isFetchNextPageError,
  onRetry,
}: {
  hasNextPage: boolean;
  isFetchNextPageError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);

  if (isFetchNextPageError) {
    return (
      <Box pl={ITEM_GAP}>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={t('friendStrip.loadMoreFailedLabel')}
          onPress={onRetry}
        >
          <ActionCell
            icon={<RefreshIcon width={16} height={16} colorClassName="text-gray-6" />}
            label={t('friendStrip.loadMoreFailed')}
          />
        </PressableFeedback>
      </Box>
    );
  }

  if (hasNextPage) {
    return (
      <Box pl={ITEM_GAP}>
        <SkeletonCell />
      </Box>
    );
  }

  return (
    <Box pl={ITEM_GAP}>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={t('friendStrip.findFriends')}
        onPress={() => push('/friends/search')}
      >
        <ActionCell
          icon={<PlusIcon width={16} height={16} colorClassName="text-gray-6" />}
          label={t('friendStrip.findFriends')}
        />
      </PressableFeedback>
    </Box>
  );
}

/**
 * 고른 친구가 잘려 있으면 보이게 옮긴다. 선택 구독을 이 칸에만 두어 선택이 바뀌어도 친구 줄 전체가
 * 다시 그려지지 않는다. 딥링크로 아직 안 불러온 친구를 고르면 친구 피드가 페이지를 이어 불러오고,
 * 같은 캐시라 여기서 그 친구가 나타나는 순간 옮긴다.
 */
function SelectedFriendReveal({
  listRef,
  friends,
  isListLoaded,
}: {
  listRef: RefObject<FlashListRef<FriendUserViewModel> | null>;
  friends: readonly FriendUserViewModel[];
  isListLoaded: boolean;
}) {
  const [selectedFriendId] = useFeedFriendIdParam();
  const { width } = useFriendStripItemSize();
  const hasRevealedRef = useRef(false);
  const selectedIndex = friends.findIndex((friend) => friend.id === selectedFriendId);

  useEffect(() => {
    const list = listRef.current;
    if (!isListLoaded || list == null || selectedIndex < 0) {
      return;
    }
    const layout = list.getLayout(selectedIndex);
    if (layout == null) {
      return;
    }
    const offset = getFriendStripRevealOffset({
      itemStart: list.getFirstItemOffset() + layout.x,
      itemWidth: layout.width,
      scrollOffset: list.getAbsoluteLastScrollOffset(),
      viewportWidth: list.getWindowSize().width,
      edgePeek: Math.round(width / 2),
    });
    if (offset != null) {
      // 화면에 처음 들어올 때는 바로 그 자리에서 시작하고, 이후 선택은 부드럽게 옮긴다
      list.scrollToOffset({ offset, animated: hasRevealedRef.current });
    }
    hasRevealedRef.current = true;
  }, [isListLoaded, listRef, selectedIndex, width]);

  return null;
}

/** 칸 크기는 앱 글자 크기 설정에서만 정해져 데이터·선택과 무관하다. 목록·스켈레톤·오류가 같은 높이를 쓴다 */
function useFriendStripItemSize() {
  const { resolveSize } = useFontScale();
  const { fontSize = 0, lineHeight = 0 } = useResolveClassNames(
    TEXT_SIZE_CLASSES[resolveSize('e1')],
  );

  return {
    width: Math.max(MIN_ITEM_WIDTH, Math.round(fontSize * LABEL_WIDTH_IN_EM)),
    height: AVATAR_FRAME_SIZE + LABEL_GAP + lineHeight,
  };
}

function StripCell({
  width,
  avatar,
  label,
}: {
  width: number;
  avatar: ReactNode;
  label: ReactNode;
}) {
  return (
    <VStack align="center" gap={LABEL_GAP} style={{ width }}>
      {avatar}
      {label}
    </VStack>
  );
}

function AvatarFrame({
  isSelected = false,
  children,
}: {
  isSelected?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      className={cn(
        'items-center justify-center rounded-full border-2',
        isSelected ? 'border-main' : 'border-transparent',
      )}
      style={{ width: AVATAR_FRAME_SIZE, height: AVATAR_FRAME_SIZE }}
    >
      {children}
    </Box>
  );
}

function ActionCell({ icon, label }: { icon: ReactNode; label: string }) {
  const { width } = useFriendStripItemSize();

  return (
    <StripCell
      width={width}
      avatar={
        <AvatarFrame>
          <Box className="size-10 items-center justify-center rounded-full bg-gray-2">{icon}</Box>
        </AvatarFrame>
      }
      label={
        <Text size="e1" shade={6} align="center" maxLines={1} className="w-full">
          {label}
        </Text>
      }
    />
  );
}

function SkeletonCell() {
  const { width } = useFriendStripItemSize();

  return (
    <StripCell
      width={width}
      avatar={
        <AvatarFrame>
          <Skeleton className="size-10 rounded-full" />
        </AvatarFrame>
      }
      label={<TextSkeleton size="e1" className="w-8" />}
    />
  );
}

function ItemGap() {
  return <Box style={{ width: ITEM_GAP }} />;
}

function Divider() {
  return (
    <Box
      className="w-px bg-gray-2"
      style={{
        height: DIVIDER_HEIGHT,
        marginTop: (AVATAR_FRAME_SIZE - DIVIDER_HEIGHT) / 2,
        marginRight: ITEM_GAP,
      }}
    />
  );
}
