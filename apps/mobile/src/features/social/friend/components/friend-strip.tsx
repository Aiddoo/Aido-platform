import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useFeedFriendId } from '@src/features/planning/todo/hooks/use-feed-params';
import { useTrack } from '@src/shared/analytics';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  HStack,
  PlusIcon,
  type QueryErrorFallbackProps,
  RefreshIcon,
  Text,
  TextSkeleton,
  useAdaptivePaneLayoutKey,
  useFetchNextPage,
  VStack,
  QueryErrorFallback,
} from '@src/shared/ui';
import { TEXT_SIZE_CLASSES } from '@src/shared/ui/text/text.variants';
import { cn } from '@src/shared/utils/cn';
import {
  usePrefetchInfiniteQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { memo, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { I18nManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';

import type { FriendUser } from '../domains/friend.model';
import { useGetFriendsInfiniteQueryOptions } from '../queries/friend.queries';
import { getFriendStripRevealOffset } from '../utils/friend-strip-scroll.geometry';

/** 아바타 40 + 양쪽 선택 링 2 + 링 안쪽 여백 2. 선택 여부와 관계없이 늘 같은 크기다 */
const AVATAR_FRAME_SIZE = 48;
const LABEL_GAP = 4;
const ITEM_GAP = 8;
const MIN_ITEM_WIDTH = 56;
/** 이름 칸은 글자 배율이 커져도 한글 네 글자 정도가 보이게 넓힌다 */
const LABEL_WIDTH_IN_EM = 4.5;
const DIVIDER_HEIGHT = 32;
const STRIP_PADDING = 16;
const LOADING_ITEM_COUNT = 8;
/** 가로 목록이라 1은 목록 폭 한 번. 끝에서 두 화면 앞에서 다음 페이지를 미리 부른다 */
const END_REACHED_THRESHOLD = 2;
/** 빠르게 넘길 때 새 칸을 그 프레임에 그리지 않도록 앞뒤 600pt(친구 8명쯤)를 미리 그려 둔다 */
const DRAW_DISTANCE = 600;

interface FriendStripProps {
  /** 초대를 쓸 수 있을 때 친구가 없는 줄에서 초대로 데려가는 동작. 없으면 친구 찾기로 보낸다 */
  onInvite?: () => void;
  /** 사용자가 피드를 내리는 등 다른 일을 시작해 안내를 닫아야 할 때 */
  isHintDismissed?: boolean;
  /** 먼저 뜰 자동 화면(알림 화면·새로운 기능)이 남았으면 false라 안내를 미룬다 */
  shouldShowHint?: boolean;
}

/**
 * 피드 위에서 나와 친구를 골라 그 사람의 피드로 바꾸는 가로 친구 줄.
 * "나"는 왼쪽에 고정하고, 친구는 서버 순서(친구 목록 편집에서 정한 순서)대로 커서 페이지를 이어 붙인다.
 */
export function FriendStrip({ onInvite, isHintDismissed, shouldShowHint }: FriendStripProps) {
  const { t } = useTranslation('friend');
  const listRef = useRef<FlashListRef<FriendUser>>(null);
  const [isListLoaded, setIsListLoaded] = useState(false);
  const { width, height } = useFriendStripItemSize();
  const edgeInsets = useStripEdgeInsets();
  const friendsQueryOptions = useGetFriendsInfiniteQueryOptions();
  // 아래에서 내 정보를 기다리며 멈추기 전에 친구 목록도 함께 받기 시작한다
  usePrefetchInfiniteQuery(friendsQueryOptions);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const [selectedFriendId, selectFriend] = useFeedFriendId();
  const {
    data: friendPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(friendsQueryOptions);

  const { items: friends } = friendPages;

  const { fetchOnEndReached, retry } = useFetchNextPage({
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  });

  return (
    <HStack align="start" style={{ height }}>
      <Box pl={STRIP_PADDING + edgeInsets.start} pr={ITEM_GAP}>
        <FriendStrip.Item
          name={t('friendStrip.me')}
          profileImage={user.profileImage}
          width={width}
          isSelected={selectedFriendId == null}
          onSelect={selectFriend}
        />
      </Box>
      <Divider />
      {friends.length === 0 ? (
        <FriendStrip.Empty
          onInvite={onInvite}
          isHintDismissed={isHintDismissed}
          shouldShowHint={shouldShowHint}
        />
      ) : (
        <>
          <FlashList
            ref={listRef}
            horizontal
            data={friends}
            extraData={selectedFriendId}
            keyExtractor={(friend) => friend.followId}
            renderItem={({ item: friend }) => (
              <FriendStrip.Item
                friendId={friend.id}
                name={friend.name ?? t('fallbackName')}
                profileImage={friend.profileImage}
                width={width}
                isSelected={selectedFriendId === friend.id}
                onSelect={selectFriend}
              />
            )}
            ItemSeparatorComponent={ItemGap}
            ListFooterComponent={
              <ListEnd
                hasNextPage={hasNextPage}
                isFetchNextPageError={isFetchNextPageError}
                onRetry={retry}
              />
            }
            onEndReached={fetchOnEndReached}
            onEndReachedThreshold={END_REACHED_THRESHOLD}
            drawDistance={DRAW_DISTANCE}
            onLoad={() => setIsListLoaded(true)}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingRight: STRIP_PADDING + edgeInsets.end }}
          />
          <SelectedFriendReveal
            listRef={listRef}
            friends={friends}
            selectedFriendId={selectedFriendId}
            isListLoaded={isListLoaded}
          />
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
  /** 피드 route의 선택을 친구 줄이 한 번 읽어 넘긴다. 칸마다 route 훅을 부르지 않는다 */
  isSelected: boolean;
  onSelect: (friendId: string | undefined) => void;
}

/** 원시 값만 받아 페이지가 붙거나 부모가 다시 그려져도 같은 친구 칸은 다시 그리지 않는다 */
FriendStrip.Item = memo(function Item({
  friendId,
  name,
  profileImage,
  width,
  isSelected,
  onSelect,
}: FriendStripItemProps) {
  const haptics = useHaptics();
  const { t } = useTranslation('friend');
  const selectFriend = useSingleTap((nextFriendId: string | undefined) => {
    haptics.selection();
    onSelect(nextFriendId);
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
          <AvatarRing isSelected={isSelected}>
            <UserAvatar size="sm" alt={name} profileImage={profileImage} />
          </AvatarRing>
        }
        label={
          <Text
            size="e1"
            shade={isSelected ? 9 : 6}
            weight={isSelected ? 'semibold' : 'normal'}
            align="center"
            numberOfLines={1}
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
  const edgeInsets = useStripEdgeInsets();

  return (
    <HStack align="start" className="overflow-hidden" style={{ height }}>
      <Box pl={STRIP_PADDING + edgeInsets.start} pr={ITEM_GAP}>
        <SkeletonCell />
      </Box>
      <Divider />
      <HStack gap={ITEM_GAP}>
        {range(LOADING_ITEM_COUNT).map((index) => (
          <SkeletonCell key={index} />
        ))}
      </HStack>
    </HStack>
  );
};

FriendStrip.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['friend', 'common']);
  const { height } = useFriendStripItemSize();
  const edgeInsets = useStripEdgeInsets();

  return (
    <QueryErrorFallback.Inline
      message={t('friend:list.loadFailed')}
      messageProps={{ numberOfLines: 2 }}
      reset={reset}
      hasInquiry
      pl={STRIP_PADDING + edgeInsets.start}
      pr={STRIP_PADDING + edgeInsets.end}
      style={{ height }}
    />
  );
};

/**
 * 친구가 없으면 "나" 옆에서 초대(초대를 못 쓰면 친구 찾기)로 이끈다. 칸 높이는 친구가 있을 때와 같다.
 * 말풍선은 첫 탭이 칸에 닿도록 통과시키고, 닫으면 계정마다 저장돼 다시 보이지 않는다.
 */
FriendStrip.Empty = function Empty({
  onInvite,
  isHintDismissed,
  shouldShowHint = true,
}: FriendStripProps) {
  const { t } = useTranslation('friend');
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);
  const isInviteAvailable = onInvite != null;
  const layoutKey = useAdaptivePaneLayoutKey();
  const label = isInviteAvailable ? t('friendStrip.emptyInvite') : t('friendStrip.findFriends');
  const hint = isInviteAvailable
    ? t('friendStrip.emptyInviteHint')
    : t('friendStrip.emptySearchHint');

  return (
    <CoachmarkPopover
      kind="friend-strip"
      description={hint}
      dismissKey={layoutKey}
      isDismissed={isHintDismissed}
      shouldAutoOpen={shouldShowHint}
      placement="bottom"
      align="start"
      avoidCollisions
      isPassThrough
      onDismiss={() =>
        trackEvent('friend_strip_hint_dismissed', {
          hint: isInviteAvailable ? 'invite' : 'search',
        })
      }
    >
      <PressableFeedback
        testID="friend-strip-empty"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={() => {
          if (onInvite != null) {
            onInvite();
            return;
          }
          push('/friends/search');
        }}
      >
        <ActionCell
          icon={<PlusIcon width={16} height={16} colorClassName="text-gray-6" />}
          label={label}
        />
      </PressableFeedback>
    </CoachmarkPopover>
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
  const { t } = useTranslation('friend');
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
        accessibilityLabel={t('friendStrip.findFriendsLabel')}
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
 * 고른 친구가 잘려 있으면 보이게 옮긴다. 딥링크로 아직 안 불러온 친구를 고르면 친구 피드가 페이지를 이어 불러오고,
 * 같은 캐시라 여기서 그 친구가 나타나는 순간 옮긴다.
 */
function SelectedFriendReveal({
  listRef,
  friends,
  selectedFriendId,
  isListLoaded,
}: {
  listRef: RefObject<FlashListRef<FriendUser> | null>;
  friends: readonly FriendUser[];
  selectedFriendId: string | undefined;
  isListLoaded: boolean;
}) {
  const { width } = useFriendStripItemSize();
  const { end: endInset } = useStripEdgeInsets();
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
      // 끝 레일 밑에 든 칸은 보이지 않는 것으로 친다
      viewportWidth: list.getWindowSize().width - endInset,
      edgePeek: Math.round(width / 2),
    });
    if (offset != null) {
      // 화면에 처음 들어올 때는 바로 그 자리에서 시작하고, 이후 선택은 부드럽게 옮긴다
      list.scrollToOffset({ offset, animated: hasRevealedRef.current });
    }
    hasRevealedRef.current = true;
  }, [isListLoaded, listRef, selectedIndex, width, endInset]);

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

function AvatarRing({
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
        <AvatarRing>
          <Box className="size-10 items-center justify-center rounded-full bg-gray-2">{icon}</Box>
        </AvatarRing>
      }
      label={
        <Text size="e1" shade={6} align="center" numberOfLines={1} className="w-full">
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
        <AvatarRing>
          <Skeleton className="size-10 rounded-full" />
        </AvatarRing>
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
    <Separator
      orientation="vertical"
      thickness={1}
      className="bg-gray-2"
      style={{
        height: DIVIDER_HEIGHT,
        marginTop: (AVATAR_FRAME_SIZE - DIVIDER_HEIGHT) / 2,
        marginRight: ITEM_GAP,
      }}
    />
  );
}

/**
 * 줄은 iPhone Duo 세로 레일 밑까지 밀리고 내용만 레일을 피한다. 앞쪽 "나" 칸과 목록 끝 여백에 그쪽 inset을 더한다.
 * 스타일의 left·right는 RTL에서 앞뒤로 바뀌므로 inset도 앞뒤로 바꿔 읽는다
 */
function useStripEdgeInsets() {
  const insets = useSafeAreaInsets();

  return I18nManager.isRTL
    ? { start: insets.right, end: insets.left }
    : { start: insets.left, end: insets.right };
}
