import { INVITE_QUALIFICATION, INVITE_REWARD_CAPS } from '@aido/api/vocabulary';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useStoreReviewMoment } from '@src/features/device/store-review/hooks/use-store-review-moment';
import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import {
  Box,
  Button,
  FishIcon,
  HStack,
  PawIcon,
  READABLE_CONTENT_MAX_WIDTH,
  Result,
  StampPress,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/number-format';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useEffect, useId, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { match, P } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { type Invite, InvitePolicy } from '../domains/invite.model';
import { useGetInviteQueryOptions } from '../queries/invite.queries';
import { pawPrintCelebrationStoredValue } from '../schemas/paw-print-celebration-storage.schema';
import {
  calculatePawPrintBoardWidth,
  calculatePawPrintGrid,
  createPawPrintBoard,
  PAW_PRINT_BOARD_SIZE,
  type PawPrintBoard,
  type PawPrintCell,
  type PawPrintState,
} from '../utils/invite-paw-print-board.geometry';
import {
  fishBoneVariants,
  pawPrintIconVariants,
  pawPrintVariants,
} from './invite-paw-print-board.variants';

const NEW_PAW_PRINT_STAGGER_MS = 160;
/** 기다리는 발자국이 흔들리기까지 쉬는 시간과 한 번 꺾는 데 걸리는 시간 */
const WAITING_WIGGLE_REST_MS = 1700;
const WAITING_WIGGLE_STEP_MS = 190;
/** 기다리는 발자국이 차례로 꺾이는 각도 */
const WAITING_WIGGLE_DEGREES = [-7, 6, -3] as const;

/**
 * 고양이 발자국 판. 친구가 사용을 시작할 때마다 발자국이 하나씩 찍힌다.
 * 지금 판(12칸)만 보여 줘서 발자국이 늘어도 높이가 바뀌지 않는다.
 */
export function InvitePawPrintBoard() {
  const { t } = useTranslation('invite');
  const dateFormatContext = useDateFormatContext();
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const celebratedCount = useCelebrateNewPawPrints(me.id, myInvite);
  const estimatedWidth = useEstimatedBoardWidth();
  // 창 폭으로 어림한 폭은 첫 그림에만 쓰고, 그 뒤로는 판이 실제로 받은 폭으로 격자를 다시 만든다
  const [boardSize, handleBoardLayout] = useLayoutSize();
  const grid = calculatePawPrintGrid(boardSize?.width ?? estimatedWidth);
  const board = createPawPrintBoard(myInvite, { columns: grid.columns, celebratedCount });

  return (
    <VStack gap={16}>
      <Text size="b4" weight="semibold" tone="brand" className="tabular-nums">
        {t('pawPrintBoard.header', {
          boardNumber: board.boardNumber,
          count: board.totalPawPrints,
          total: formatCount(board.totalPawPrints, dateFormatContext.locale),
        })}
      </Text>

      <Text size="b3" shade={7} lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
        {t('pawPrintBoard.rewardRule', {
          activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS,
          days: InvitePolicy.getNextPremiumDays(myInvite),
          slots: InvitePolicy.getNextFriendSlots(myInvite),
          count: InvitePolicy.getNextFriendSlots(myInvite),
        })}
      </Text>

      {/* 줄마다 칸·생선 뼈 폭을 같은 pt로 정해 모든 줄이 같은 열에 놓인다. flex로 나누지 않는다 */}
      <VStack accessibilityRole="list" align="center" onLayout={handleBoardLayout}>
        {board.rows.map((row, rowIndex) => (
          // 열 수가 바뀌면(Duo 접기·펼치기, iPad 창 크기) 칸이 다른 줄·자리로 옮겨 간다.
          // 옮겨 간 칸을 재사용하면 이전 격자 배치가 남으므로 열 수마다 줄을 새로 그린다
          <VStack key={`${grid.columns}-${rowIndex}`} style={{ width: grid.rowWidth }}>
            <HStack align="center">
              {row.cells.map((cell) => (
                <HStack key={cell.index} align="center">
                  {cell.connectorBefore != null && (
                    <InvitePawPrintBoard.Connector
                      isFilled={cell.connectorBefore.isFilled}
                      length={grid.connectorLength}
                    />
                  )}
                  <InvitePawPrintBoard.PawPrint
                    cell={cell}
                    size={grid.cellSize}
                    newPawPrintOrder={cell.index - celebratedCount}
                  />
                </HStack>
              ))}
            </HStack>
            {row.turn != null && (
              <HStack
                justify={row.turn.side === 'end' ? 'end' : 'start'}
                style={{ paddingHorizontal: grid.turnInset }}
              >
                <InvitePawPrintBoard.Connector
                  isFilled={row.turn.isFilled}
                  orientation="vertical"
                />
              </HStack>
            )}
          </VStack>
        ))}
      </VStack>

      <InvitePawPrintBoard.Caption board={board} />

      <Box className="rounded-2xl bg-white px-3.5 py-3">
        <InviteProgressMessage />
      </Box>
    </VStack>
  );
}

/**
 * 판 아래 한 줄. 다 채운 판에서는 축하를, 판에 다 못 그린 기다리는 친구가 있으면 그 수를,
 * 빈 판에서는 어디부터 찍히는지 보여 준다
 */
InvitePawPrintBoard.Caption = function Caption({ board }: { board: PawPrintBoard }) {
  const { t } = useTranslation('invite');

  return (
    <Text
      size="b4"
      weight="medium"
      shade={6}
      align="center"
      className="min-h-5"
      lineBreakStrategyIOS="hangul-word"
      textBreakStrategy="highQuality"
    >
      {match(board)
        .with({ isComplete: true }, () => (
          <Text size="b4" weight="bold" tone="brand">
            {t('pawPrintBoard.complete', { boardNumber: board.boardNumber })}
          </Text>
        ))
        .with({ waitingOverflowCount: P.number.positive() }, ({ waitingOverflowCount }) =>
          t('pawPrintBoard.waitingOverflow', { count: waitingOverflowCount }),
        )
        .with({ totalPawPrints: 0 }, () =>
          t('pawPrintBoard.firstHint', { activeDays: INVITE_QUALIFICATION.MIN_ACTIVE_DAYS }),
        )
        .with({ isComplete: false }, () => null)
        .exhaustive()}
    </Text>
  );
};

interface PawPrintProps {
  cell: PawPrintCell;
  /** 칸 지름(pt). 판 격자가 정한다 */
  size: number;
  /** 새로 찍힌 발자국 중 몇 번째인지. 차례로 찍히게 지연한다 */
  newPawPrintOrder: number;
}

InvitePawPrintBoard.PawPrint = function PawPrint({ cell, size, newPawPrintOrder }: PawPrintProps) {
  const { t } = useTranslation('invite');
  const label = t('pawPrintBoard.cellLabel', {
    number: cell.index + 1,
    state: t(PAW_PRINT_STATE_LABEL_KEYS[cell.state]),
  });

  return (
    <Box
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
    >
      {match({ state: cell.state, isNew: cell.isNew })
        .with({ state: 'stamped', isNew: true }, () => (
          <StampPress delay={newPawPrintOrder * NEW_PAW_PRINT_STAGGER_MS}>
            <Box style={{ width: size, height: size }}>
              <StaticPawPrint state="stamped" />
            </Box>
          </StampPress>
        ))
        .with({ state: 'stamped', isNew: false }, () => <StaticPawPrint state="stamped" />)
        .with({ state: 'waiting' }, () => <WaitingPawPrint />)
        .with({ state: 'empty' }, () => <StaticPawPrint state="empty" isNext={cell.isNext} />)
        .with({ state: 'milestone' }, () => <InvitePawPrintBoard.Milestone />)
        .exhaustive()}
    </Box>
  );
};

InvitePawPrintBoard.Milestone = function Milestone() {
  return (
    <Box className={pawPrintVariants({ state: 'milestone' })}>
      <FishIcon
        width={28}
        height={16}
        colorClassName={pawPrintIconVariants({ state: 'milestone' })}
      />
    </Box>
  );
};

interface ConnectorProps {
  isFilled: boolean;
  orientation?: 'horizontal' | 'vertical';
  /** 가로 생선 뼈 길이(pt). 없으면 남은 폭을 채운다 */
  length?: number;
}

/** 발자국 사이를 잇는 생선 뼈. 찍힌 발자국 사이만 main 색으로 채운다 */
InvitePawPrintBoard.Connector = function Connector({
  isFilled,
  orientation = 'horizontal',
  length,
}: ConnectorProps) {
  const patternId = useId();
  const { color } = useResolveClassNames(fishBoneVariants({ isFilled }));
  const isHorizontal = orientation === 'horizontal';
  const horizontalStyle = length == null ? styles.fill : { width: length };

  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(isHorizontal ? 'h-3' : 'h-[22px] w-3')}
      style={isHorizontal ? horizontalStyle : undefined}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={isHorizontal ? 7 : 12}
            height={isHorizontal ? 12 : 7}
          >
            <Rect
              x={isHorizontal ? 5 : 1}
              y={isHorizontal ? 1 : 5}
              width={isHorizontal ? 2 : 10}
              height={isHorizontal ? 10 : 2}
              fill={color}
            />
          </Pattern>
        </Defs>
        <Rect
          x={isHorizontal ? 0 : 5}
          y={isHorizontal ? 5 : 0}
          width={isHorizontal ? '100%' : 2}
          height={isHorizontal ? 2 : '100%'}
          fill={color}
        />
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </Box>
  );
};

InvitePawPrintBoard.Loading = function Loading() {
  // 불러온 판과 같은 격자로 자리를 잡아 내용이 들어와도 높이가 튀지 않는다
  const grid = calculatePawPrintGrid(useEstimatedBoardWidth());

  return (
    <VStack gap={16} accessibilityState={{ busy: true }}>
      <TextSkeleton size="b4" className="w-44" />
      <VStack>
        <TextSkeleton size="b3" className="w-full" />
        <TextSkeleton size="b3" className="w-full" />
        <TextSkeleton size="b3" className="w-40" />
      </VStack>
      {/* oxlint-disable-next-line aido/spacing-scale -- 불러온 판의 세로 연결선 높이(h-[22px])와 줄 간격을 맞춘다 */}
      <VStack align="center" gap={22}>
        {range(PAW_PRINT_BOARD_SIZE / grid.columns).map((rowIndex) => (
          <HStack key={rowIndex} style={{ width: grid.rowWidth, gap: grid.connectorLength }}>
            {range(grid.columns).map((index) => (
              <Skeleton
                key={index}
                className="rounded-full"
                style={{ width: grid.cellSize, height: grid.cellSize }}
              />
            ))}
          </HStack>
        ))}
      </VStack>
      <Box className="h-5" />
      <Skeleton className="h-[66px] rounded-2xl dark:bg-gray-2" />
    </VStack>
  );
};

InvitePawPrintBoard.Unavailable = function Unavailable() {
  const { t } = useTranslation('invite');

  return (
    <Box className="min-h-[220px] items-center justify-center">
      <Result title={t('pawPrintBoard.unavailable')} />
    </Box>
  );
};

/**
 * 지난번에 본 수보다 늘었으면 진동과 리뷰 요청으로 축하하고 본 수를 저장한다.
 * 돌려주는 값은 처음 그릴 때 본 수다. 저장한 뒤에도 이번 화면에서는 찍히는 애니메이션이 이어져야 한다
 */
function useCelebrateNewPawPrints(userId: string, invite: Invite) {
  const { qualifiedCount } = invite;
  const haptics = useHaptics();
  const { requestReviewAt } = useStoreReviewMoment();
  const storage = useStoredValueStorage(pawPrintCelebrationStoredValue);
  // 축하하는 동안 방금 저장한 수로 바뀌지 않게 화면에 들어올 때 한 번만 읽는다
  const [celebratedCount] = useState(() =>
    readStoredValue(storage, pawPrintCelebrationStoredValue, userId),
  );
  const hasNewPawPrint = InvitePolicy.hasNewPawPrints(invite, celebratedCount);

  useEffect(() => {
    if (qualifiedCount === celebratedCount) {
      return;
    }

    // 줄어든 경우(보상 회수 등)에도 그 수로 맞춰 다음 발자국에서 다시 축하한다
    writeStoredValue(storage, pawPrintCelebrationStoredValue, qualifiedCount, userId);
    if (hasNewPawPrint) {
      haptics.notify('success');
      // 찍히는 애니메이션이 끝날 때까지는 서비스가 기다리고, 화면을 떠나면 훅이 취소한다
      requestReviewAt('paw_print_celebration');
    }
  }, [celebratedCount, haptics, hasNewPawPrint, qualifiedCount, requestReviewAt, storage, userId]);

  return celebratedCount;
}

function useEstimatedBoardWidth() {
  const { width: frameWidth } = useSafeAreaFrame();
  const { left: insetLeft, right: insetRight } = useSafeAreaInsets();

  return calculatePawPrintBoardWidth({
    frameWidth,
    insetLeft,
    insetRight,
    maxContentWidth: READABLE_CONTENT_MAX_WIDTH,
  });
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

const PAW_PRINT_STATE_LABEL_KEYS = {
  stamped: 'pawPrintBoard.state.stamped',
  waiting: 'pawPrintBoard.state.waiting',
  empty: 'pawPrintBoard.state.empty',
  milestone: 'pawPrintBoard.state.milestone',
} as const satisfies Record<PawPrintState, string>;

function StaticPawPrint({ state, isNext = false }: { state: PawPrintState; isNext?: boolean }) {
  return (
    <Box className={pawPrintVariants({ state, isNext })}>
      {state === 'stamped' && (
        <Box className="absolute inset-[5px] rounded-full border border-dashed border-white/90 dark:border-gray-1/90" />
      )}
      <PawIcon width={26} height={26} colorClassName={pawPrintIconVariants({ state, isNext })} />
    </Box>
  );
}

/** 기다리는 발자국은 가끔 살짝 흔들려 곧 찍힐 것을 알린다. 화면이 가려지거나 앱이 뒤로 가면 UI 스레드에서 돌지 않게 멈춘다 */
function WaitingPawPrint() {
  const isAnimating = useIsAnimationActive();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!isAnimating) {
      rotation.set(0);
      return;
    }

    const step = { duration: WAITING_WIGGLE_STEP_MS, reduceMotion: ReduceMotion.System };
    rotation.set(
      withRepeat(
        withSequence(
          withDelay(WAITING_WIGGLE_REST_MS, withTiming(WAITING_WIGGLE_DEGREES[0], step)),
          withTiming(WAITING_WIGGLE_DEGREES[1], step),
          withTiming(WAITING_WIGGLE_DEGREES[2], step),
          withTiming(0, step),
        ),
        -1,
      ),
    );

    return () => cancelAnimation(rotation);
  }, [isAnimating, rotation]);

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Animated.View style={[styles.fill, wiggleStyle]}>
      <StaticPawPrint state="waiting" />
    </Animated.View>
  );
}

function InviteProgressMessage() {
  const { t } = useTranslation('invite');
  const { data: myInvite } = useSuspenseQuery(useGetInviteQueryOptions());
  const remaining = InvitePolicy.getRemainingToNextMilestone(myInvite);

  return match(InvitePolicy.getProgress(myInvite))
    .with('not-started', () => (
      <Text size="b4" shade={7} lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
        {t('pawPrintBoard.progress.notStarted')}
      </Text>
    ))
    .with('monthly-cap-reached', () => (
      <VStack gap={12}>
        <Text
          size="b4"
          shade={7}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {t('pawPrintBoard.progress.monthlyCapReached', {
            windowDays: INVITE_REWARD_CAPS.WINDOW_DAYS,
            days: INVITE_REWARD_CAPS.PREMIUM_DAYS_PER_30_DAYS,
          })}
        </Text>
        <KeepPremiumButton />
      </VStack>
    ))
    .with('total-cap-reached', () => (
      <VStack gap={12}>
        <Text
          size="b4"
          shade={7}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {t('pawPrintBoard.progress.totalCapReached', {
            days: INVITE_REWARD_CAPS.PREMIUM_DAYS_TOTAL,
          })}
        </Text>
        <KeepPremiumButton />
      </VStack>
    ))
    .with('in-progress', () => (
      <VStack gap={2}>
        <Text size="b4" weight="semibold" shade={8} className="tabular-nums">
          {t('pawPrintBoard.rewardsSummary', {
            count: InvitePolicy.getEarnedPremiumDays(myInvite),
            slots: InvitePolicy.getEarnedFriendSlots(myInvite),
          })}
        </Text>
        {remaining != null && (
          <Text
            size="b4"
            shade={6}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="highQuality"
          >
            {t('pawPrintBoard.progress.next', { count: remaining })}
          </Text>
        )}
      </VStack>
    ))
    .exhaustive();
}

/**
 * 초대 보상 프리미엄 상한에 닿았을 때 구독 화면으로 가는 버튼. 이동만 하고 보상·상한은 서버가 정한다.
 * 이미 스토어 구독 중이면 권하지 않는다
 */
function KeepPremiumButton() {
  const { t } = useTranslation('invite');
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const navigate = useSingleTap(router.navigate);

  if (PremiumAccessPolicy.isStoreSubscribed(me.premiumAccess)) {
    return null;
  }

  return (
    <Button
      variant="weak"
      size="medium"
      display="inline"
      accessibilityHint={t('pawPrintBoard.keepPremiumHint')}
      onPress={() => navigate('/paywall')}
    >
      {t('pawPrintBoard.keepPremium')}
    </Button>
  );
}
