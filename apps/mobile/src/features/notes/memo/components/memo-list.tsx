import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useStartVoiceNote } from '@src/features/voice/hooks/use-start-voice-note';
import { useVoiceNotes } from '@src/features/voice/hooks/use-voice-notes';
import { ANIMATION } from '@src/shared/constants/animation';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  HStack,
  MemoIllustration,
  PinFilledIcon,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Result,
  Spacing,
  StyledSafeAreaView,
  SurfaceCard,
  Text,
  TextSkeleton,
  usePaneSizeClass,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  useMutation,
  usePrefetchQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { noop, range } from 'es-toolkit';
import { Link } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import {
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  LayoutAnimation,
  type LayoutAnimationConfig,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import type { Memo } from '../domains/memo.model';
import { useSelectedMemoId } from '../hooks/use-memo-params';
import { useOpenMemoDeleteDialog } from '../hooks/use-open-memo-delete-dialog';
import { refreshMemos } from '../queries/memo-cache';
import { useSetMemoPinnedMutationOptions } from '../queries/memo.mutations';
import { useGetMemosInfiniteQueryOptions } from '../queries/memo.queries';
import {
  getEnteringMemoIds,
  getMemoColumnCount,
  getMemoListChange,
} from '../utils/memo-list.view-model';
import { toMemoPreview } from '../utils/memo.view-model';
import { getScrollProgress } from '../utils/scroll-progress.geometry';
import { ScrollProgressWidget } from './scroll-progress-widget';

const LOADING_ITEMS_PER_COLUMN = 2;
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;
/** 칸마다 좌우로 간격의 반을 두어 카드 사이 12, 바깥 여백 16이 된다. 칸이 어느 열에 놓였는지 몰라도 같다 */
const CELL_INSET = CARD_GAP / 2;
const EDGE_ITEM_STYLE = { paddingHorizontal: CELL_INSET };
const HEADER_GAP = 16;
const TITLE_GAP = 8;
/** 마지막 카드 아래 칸 간격(12)과 합쳐 원래 끝 여백 24가 된다 */
const LIST_BOTTOM_PADDING = 24 - CARD_GAP;
const MORE_BUTTON_TOP_GAP = 20 - CARD_GAP;
const SCROLL_PROGRESS_BOTTOM_OFFSET = 16;
const ENTERING_OFFSET_Y = 8;
const ENTERING_TIMING = {
  duration: ANIMATION.durationMs.normal,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};
/** 만들기·고정·삭제로 순서가 바뀔 때만 카드가 새 자리로 미끄러진다(원래 카드마다 걸던 LinearTransition 자리) */
const MEMO_REORDER_LAYOUT_ANIMATION = {
  duration: ANIMATION.durationMs.slow,
  update: { type: LayoutAnimation.Types.easeOut },
} satisfies LayoutAnimationConfig;
const TITLE_LINE_COUNT_WITH_BODY = 2;
const TITLE_LINE_COUNT_ALONE = 4;

interface MemoListProps {
  /** 목록 위에 함께 스크롤되는 머리말(말로 남긴 메모 초안) */
  header?: ReactNode;
}

/**
 * 메모 카드 masonry. FlashList가 칸을 재사용하고 칸 자리만 바꾸므로 탭 전환·칸 수·폭이 바뀌어도 카드가 미끄러져 오지 않는다.
 * 새로 생긴 메모만 그 자리에서 짧게 나타난다
 */
export function MemoList({ header }: MemoListProps) {
  const queryClient = useQueryClient();
  const meQueryOptions = useGetMeQueryOptions();
  // 칸마다 route 훅을 부르면 URL이 바뀔 때마다 메모 수만큼 params를 다시 파싱한다. 목록이 한 번 읽어 넘긴다
  const [selectedMemoId, setSelectedMemoId] = useSelectedMemoId();

  // 메모 목록이 먼저 멈추면 내 정보 조회가 그 뒤에야 시작한다. 둘을 함께 시작한다
  usePrefetchQuery(meQueryOptions);
  const {
    data: fetchedMemos,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(useGetMemosInfiniteQueryOptions());
  const { data: me } = useSuspenseQuery(meQueryOptions);

  const listRef = useRef<FlashListRef<Memo>>(null);
  const progress = useSharedValue(0);

  const [voiceNotes] = useVoiceNotes(me.id);
  const paneSizeClass = usePaneSizeClass();
  const memos = useDisplayedMemos(fetchedMemos, listRef);
  const [enteringMemoIds, markEntered] = useEnteringMemoIds(memos);
  const [isRefreshing, handleRefresh] = useRefresh(() => refreshMemos(queryClient));

  const columnCount = getMemoColumnCount(paneSizeClass, memos.length);
  const isSavedTitleShown = voiceNotes.length > 0 && memos.length > 0;

  // FlashList는 스크롤을 JS에서 받아 칸을 재사용한다. 같은 이벤트로 진행 비율만 UI 스레드 값에 쓴다
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    progress.set(getScrollProgress(event.nativeEvent));
  };

  return (
    <>
      <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
        <FlashList
          ref={listRef}
          data={memos}
          masonry
          // 원래 손 masonry처럼 왼쪽부터 번갈아 채운다. 켜면 짧은 열부터 채워 순서가 바뀐다
          optimizeItemArrangement={false}
          numColumns={columnCount}
          keyExtractor={(memo) => String(memo.id)}
          extraData={{ selectedMemoId, columnCount, enteringMemoIds, paneSizeClass }}
          renderItem={({ item }) => (
            <MemoList.Cell>
              <MemoList.Item
                memo={item}
                isSelected={selectedMemoId === item.id}
                isEntering={enteringMemoIds.has(item.id)}
                isLinked={paneSizeClass === 'compact'}
                onSelect={setSelectedMemoId}
                onEntered={markEntered}
              />
            </MemoList.Cell>
          )}
          ListHeaderComponent={
            <MemoList.Header isSavedTitleShown={isSavedTitleShown}>{header}</MemoList.Header>
          }
          ListHeaderComponentStyle={EDGE_ITEM_STYLE}
          ListEmptyComponent={voiceNotes.length > 0 ? null : <MemoList.Empty />}
          ListEmptyComponentStyle={[EDGE_ITEM_STYLE, { flex: 1 }]}
          ListFooterComponent={
            hasNextPage ? (
              <VStack pt={MORE_BUTTON_TOP_GAP}>
                <MemoList.More
                  onPress={() => fetchNextPage({ cancelRefetch: false })}
                  isLoading={isFetchingNextPage}
                  isDisabled={isFetching}
                  hasError={isFetchNextPageError}
                />
              </VStack>
            ) : null
          }
          ListFooterComponentStyle={EDGE_ITEM_STYLE}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: HORIZONTAL_PADDING - CELL_INSET,
            paddingBottom: LIST_BOTTOM_PADDING,
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </StyledSafeAreaView>

      <ScrollProgressWidget
        progress={progress}
        onScrollToTop={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        bottomOffset={SCROLL_PROGRESS_BOTTOM_OFFSET}
      />
    </>
  );
}

/** 머리말(초안) 아래, 초안이 있을 때만 저장된 메모 제목을 둔다 */
MemoList.Header = function Header({
  isSavedTitleShown,
  children,
}: PropsWithChildren<{ isSavedTitleShown: boolean }>) {
  const { t } = useTranslation('memo');

  return (
    <VStack>
      {children}
      {isSavedTitleShown && (
        <>
          <Spacing size={HEADER_GAP} />
          <Text size="b4" weight="semibold" shade={6}>
            {t('list.savedTitle')}
          </Text>
          <Spacing size={TITLE_GAP} />
        </>
      )}
    </VStack>
  );
};

// 카드 사이 간격을 칸 패딩으로 나눠 가진다
MemoList.Cell = function Cell({ children }: PropsWithChildren) {
  return <Box className="px-1.5 pb-3">{children}</Box>;
};

interface MemoListItemProps {
  memo: Memo;
  isSelected: boolean;
  /** 지난 그림 뒤에 새로 생긴 메모. 한 번만 짧게 나타난다 */
  isEntering: boolean;
  /** 접힌 화면에서만 Link다. 펼친 화면은 같은 화면의 칸을 바꿔 미리볼 상세 화면이 없다 */
  isLinked: boolean;
  onSelect: (memoId: number) => void;
  onEntered: (memoId: number) => void;
}

MemoList.Item = function Item({
  memo,
  isSelected,
  isEntering,
  isLinked,
  onSelect,
  onEntered,
}: MemoListItemProps) {
  const { t } = useTranslation(['memo', 'common']);
  const fontScaledSize = useFontScaledSize();
  const selectMemo = useSingleTap(onSelect);
  const cardActions = useMemoCardActions(memo);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const isReduceMotionEnabled = useIsReduceMotionEnabled();

  const appearance = useSharedValue(isEntering && !isReduceMotionEnabled ? 0 : 1);

  const { title, body } = toMemoPreview(memo);
  const appearanceStyle = useAnimatedStyle(() => ({
    opacity: appearance.get(),
    transform: [{ translateY: (1 - appearance.get()) * ENTERING_OFFSET_Y }],
  }));

  const appear = useEffectEvent(() => {
    if (!isEntering) {
      appearance.set(1);
      return;
    }
    onEntered(memo.id);
    if (isReduceMotionEnabled) {
      appearance.set(1);
      return;
    }
    appearance.set(0);
    appearance.set(withTiming(1, ENTERING_TIMING));
  });

  // 칸은 다른 메모에 다시 쓰인다. 메모가 바뀔 때만 그 메모 기준으로 정해 이전 메모의 움직임이 남지 않게 한다.
  // 그리기 전에 정해 재사용 칸이 새 메모를 한 프레임 다 보인 채 그리지 않는다. 나타나기 시작한 뒤 isEntering이 꺼져도 끊지 않는다
  useLayoutEffect(() => {
    appear();
  }, [memo.id]);

  return (
    <Animated.View style={appearanceStyle}>
      <MemoList.ItemLink
        memo={memo}
        isLinked={isLinked}
        actions={cardActions}
        onOpen={() => selectMemo(memo.id)}
      >
        <PressableFeedback
          onPress={() => selectMemo(memo.id)}
          // 고정·삭제는 iOS에서 길게 눌러 메뉴로, 스크린리더는 플랫폼과 상관없이 동작 메뉴로 카드에서 바로 한다
          accessibilityActions={[
            {
              name: 'togglePin',
              label: t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin'),
            },
            { name: 'delete', label: t('common:actions.delete') },
          ]}
          onAccessibilityAction={(event) =>
            match(event.nativeEvent.actionName)
              .with('togglePin', () => cardActions.togglePin())
              .with('delete', () => cardActions.openDeleteDialog())
              .otherwise(noop)
          }
          className="rounded-2xl"
          testID={`memo-item-${memo.id}`}
        >
          <VStack
            gap={8}
            className={cn(
              'rounded-2xl border bg-gray-1 p-4',
              isSelected ? 'border-main' : 'border-transparent',
            )}
          >
            <HStack align="start" gap={8}>
              <Text
                className="flex-1"
                size="b3"
                weight="semibold"
                numberOfLines={
                  body.length > 0 ? TITLE_LINE_COUNT_WITH_BODY : TITLE_LINE_COUNT_ALONE
                }
                lineBreakStrategyIOS="hangul-word"
              >
                {title}
              </Text>
              {memo.isPinned && (
                <PinFilledIcon
                  width={fontScaledSize(14)}
                  height={fontScaledSize(14)}
                  colorClassName="text-main"
                />
              )}
            </HStack>
            {body.length > 0 && (
              <Text size="b4" shade={6} numberOfLines={3} lineBreakStrategyIOS="hangul-word">
                {body}
              </Text>
            )}
            <Text size="e1" shade={5}>
              {formatYearAwareDateLabel(memo.createdAt, todayKey, dateFormatContext)}
            </Text>
          </VStack>
        </PressableFeedback>
      </MemoList.ItemLink>
    </Animated.View>
  );
};

interface MemoListItemLinkProps extends PropsWithChildren {
  memo: Memo;
  isLinked: boolean;
  actions: MemoCardActions;
  onOpen: () => void;
}

/**
 * 카드를 길게 눌러 메모를 미리보고 열기·고정·삭제를 고른다(iOS). 탭은 카드의 고르기가 맡아 Link의 이동은 막고,
 * 미리보기를 눌러 가는 이동만 Link가 맡는다
 */
MemoList.ItemLink = function ItemLink({
  memo,
  isLinked,
  actions,
  onOpen,
  children,
}: MemoListItemLinkProps) {
  const { t } = useTranslation(['memo', 'common']);

  if (!isLinked) {
    return children;
  }

  return (
    <Link
      href={{ pathname: '/memo/[memoId]', params: { memoId: memo.id } }}
      asChild
      onPress={(event) => event.preventDefault()}
    >
      <Link.Trigger>{children}</Link.Trigger>
      <Link.Preview />
      <Link.Menu>
        <Link.MenuAction icon="doc.text" onPress={onOpen}>
          {t('memo:list.open')}
        </Link.MenuAction>
        <Link.MenuAction
          icon={memo.isPinned ? 'pin.slash' : 'pin'}
          disabled={actions.isPinPending}
          onPress={actions.togglePin}
        >
          {t(memo.isPinned ? 'memo:detail.unpin' : 'memo:detail.pin')}
        </Link.MenuAction>
        <Link.MenuAction icon="trash" destructive onPress={actions.openDeleteDialog}>
          {t('common:actions.delete')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
};

MemoList.More = function More({
  hasError,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & { hasError: boolean }) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <VStack align="center" gap={8} pb={12}>
      {hasError && (
        <Text size="b4" shade={6} align="center">
          {t('memo:list.nextPageFailed')}
        </Text>
      )}
      <Button variant="weak" display="inline" {...props}>
        {t(hasError ? 'common:actions.retry' : 'memo:list.loadMore')}
      </Button>
    </VStack>
  );
};

MemoList.Loading = function Loading({ header }: MemoListProps) {
  const paneSizeClass = usePaneSizeClass();

  const columnCount = getMemoColumnCount(paneSizeClass, Number.POSITIVE_INFINITY);

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <Box className="flex-1 gap-4 px-4">
        {header}
        <HStack gap={CARD_GAP} align="start">
          {range(columnCount).map((column) => (
            <VStack key={column} flex={1} gap={CARD_GAP}>
              {range(LOADING_ITEMS_PER_COLUMN).map((row) => (
                <SurfaceCard key={row} className="gap-2">
                  <TextSkeleton size="b3" className="w-full" />
                  <TextSkeleton size="b3" className="w-3/4" />
                  <TextSkeleton size="e1" className="w-1/2" />
                </SurfaceCard>
              ))}
            </VStack>
          ))}
        </HStack>
      </Box>
    </StyledSafeAreaView>
  );
};

MemoList.Error = function ErrorFallback({
  reset,
  header,
}: QueryErrorFallbackProps & MemoListProps) {
  const { t } = useTranslation(['memo', 'common']);

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <Box className="flex-1 gap-4 px-4">
        {header}
        <HStack flex={1} justify="center" align="center">
          <QueryErrorFallback title={t('memo:list.loadFailed')} reset={reset} />
        </HStack>
      </Box>
    </StyledSafeAreaView>
  );
};

MemoList.Empty = function Empty() {
  const { t } = useTranslation('memo');
  const { t: tVoiceNote } = useTranslation('voiceNote');
  // 연타가 시작 탭 이벤트와 동의·권한 확인을 두 번 내지 않게 한다
  const startVoiceNote = useSingleTap(useStartVoiceNote());

  return (
    <HStack flex={1} justify="center" align="center">
      <Result
        icon={<MemoIllustration />}
        title={t('list.emptyTitle')}
        description={t('list.emptyDescription')}
        button={
          <Result.Button onPress={() => startVoiceNote()}>
            {tVoiceNote('start.label')}
          </Result.Button>
        }
      />
    </HStack>
  );
};

/** 순서가 바뀔 때(만들기·고정·삭제)만 FlashList 권장대로 재사용을 멈추고 LayoutAnimation을 걸어 카드가 미끄러진다. 탭 전환·다시 마운트·칸 수 변경·다음 쪽은 움직이지 않는다 */
type MemoCardActions = ReturnType<typeof useMemoCardActions>;

/** 카드에서 바로 하는 고정·삭제. iOS 길게 누르기 메뉴와 스크린리더 동작이 같은 것을 부른다 */
function useMemoCardActions(memo: Memo) {
  const setPinned = useMutation(useSetMemoPinnedMutationOptions({ memoId: memo.id }));
  const openDeleteDialog = useOpenMemoDeleteDialog({ memoId: memo.id });

  return {
    isPinPending: setPinned.isPending,
    togglePin: () => {
      if (!setPinned.isPending) {
        setPinned.mutate({ isPinned: !memo.isPinned });
      }
    },
    openDeleteDialog: () => openDeleteDialog(),
  };
}

function useDisplayedMemos(
  memos: readonly Memo[],
  listRef: RefObject<FlashListRef<Memo> | null>,
): readonly Memo[] {
  const isAnimationActive = useIsAnimationActive();
  const [displayedMemos, setDisplayedMemos] = useState(memos);

  const change = getMemoListChange(
    displayedMemos.map(({ id }) => id),
    memos.map(({ id }) => id),
  );

  if (displayedMemos !== memos && change !== 'reordered') {
    setDisplayedMemos(memos);
  }

  useEffect(() => {
    if (displayedMemos === memos || change !== 'reordered') {
      return;
    }
    // 화면 밖·앱 뒤·모션 줄이기에서는 움직이지 않고 바로 바꾼다
    if (isAnimationActive) {
      listRef.current?.prepareForLayoutAnimationRender();
      LayoutAnimation.configureNext(MEMO_REORDER_LAYOUT_ANIMATION);
    }
    // oxlint-disable-next-line react/set-state-in-effect -- LayoutAnimation은 바뀐 목록을 그리는 갱신 앞에 걸어야 한다(FlashList 문서)
    setDisplayedMemos(memos);
  }, [memos, displayedMemos, change, isAnimationActive, listRef]);

  return displayedMemos;
}

/**
 * 지난 그림 뒤 새로 생긴 메모 id를 고르고, 카드가 나타나기 시작하면 지운다.
 * 처음 그림은 아는 메모로만 시작해 탭 전환·다시 마운트·칸 수 변경에는 아무것도 나타나지 않는다
 */
function useEnteringMemoIds(memos: readonly Memo[]) {
  const memoIdsKey = memos.map(({ id }) => id).join(',');
  const [tracked, setTracked] = useState(() => ({
    memoIdsKey,
    knownIds: new Set(memos.map(({ id }) => id)),
    enteringIds: new Set<number>(),
  }));

  // 목록이 바뀐 그림에서 바로 고른다(React "이전 렌더의 정보 저장" 방식). 효과로 고르면 한 프레임 늦게 나타나 깜박인다
  if (tracked.memoIdsKey !== memoIdsKey) {
    const memoIds = memos.map(({ id }) => id);
    const entering = getEnteringMemoIds(tracked.knownIds, memoIds);
    setTracked({
      memoIdsKey,
      knownIds: new Set([...tracked.knownIds, ...memoIds]),
      enteringIds: new Set([...tracked.enteringIds, ...entering]),
    });
  }

  const markEntered = (memoId: number) =>
    setTracked((previous) => {
      if (!previous.enteringIds.has(memoId)) {
        return previous;
      }
      const enteringIds = new Set(previous.enteringIds);
      enteringIds.delete(memoId);
      return { ...previous, enteringIds };
    });

  return [tracked.enteringIds, markEntered] as const;
}
