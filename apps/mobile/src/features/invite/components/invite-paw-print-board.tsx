import { useInviteService } from '@src/bootstrap/providers/di-context';
import { useStoreReviewMoment } from '@src/features/store-review/hooks/use-store-review-moment';
import {
  type PremiumAccess,
  PremiumAccessPolicy,
} from '@src/features/subscription/domains/premium-access.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  FishIcon,
  HStack,
  PawIcon,
  READABLE_CONTENT_MAX_WIDTH,
  Result,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/format';
import { notifySuccess } from '@src/shared/utils/haptics';
import { useSuspenseQueries } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, useEffect, useId, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { match, P } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import { InvitePolicy } from '../domains/invite.model';
import { InvitedFriendPolicy } from '../domains/invited-friend.model';
import { useGetInviteQueryOptions } from '../queries/get-invite-query-options';
import {
  calculatePawPrintBoardWidth,
  calculatePawPrintGrid,
  createPawPrintBoard,
  PAW_PRINT_BOARD_SIZE,
  type PawPrintBoard,
  type PawPrintCell,
  type PawPrintState,
} from '../utils/view-models/invite-paw-print-board.view-model';
import {
  fishBoneVariants,
  pawPrintIconVariants,
  pawPrintVariants,
} from './invite-paw-print-board.variants';

const PAW_PRINT_PRESS_SPRING = {
  duration: 400,
  dampingRatio: 0.55,
  reduceMotion: ReduceMotion.System,
};
const NEW_PAW_PRINT_STAGGER_MS = 160;
const MIN_CONNECTOR_LENGTH = 12;

/**
 * 고양이 발자국 판. 친구가 사용을 시작할 때마다 발자국이 하나씩 찍힌다.
 * 지금 판(12칸)만 보여 줘서 발자국이 늘어도 높이가 바뀌지 않는다.
 */
export function InvitePawPrintBoard({ className, ...props }: ComponentProps<typeof VStack>) {
  const { t } = useTranslation('invite');
  const dateFormatContext = useDateFormatContext();
  const inviteService = useInviteService();
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const userId = me.id;
  const { width: frameWidth } = useSafeAreaFrame();
  const { left: insetLeft, right: insetRight } = useSafeAreaInsets();
  // 처음 그릴 때 본 수를 고정해 두어야 저장한 뒤에도 이번 화면에서는 애니메이션이 이어진다
  const [celebratedCount] = useState(() => inviteService.getCelebratedPawPrintCount(userId));
  // 창 폭으로 어림한 폭은 첫 그림에만 쓰고, 그 뒤로는 판이 실제로 받은 폭으로 격자를 다시 만든다
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const grid = calculatePawPrintGrid(
    measuredWidth ??
      calculatePawPrintBoardWidth({
        frameWidth,
        insetLeft,
        insetRight,
        maxContentWidth: READABLE_CONTENT_MAX_WIDTH,
      }),
  );
  const board = createPawPrintBoard(myInvite, { columns: grid.columns, celebratedCount });
  const hasNewPawPrint = myInvite.qualifiedCount > celebratedCount;
  const { requestReviewAt } = useStoreReviewMoment();

  useEffect(() => {
    if (myInvite.qualifiedCount === celebratedCount) {
      return;
    }

    inviteService.markPawPrintsCelebrated(userId, myInvite.qualifiedCount);
    if (hasNewPawPrint) {
      notifySuccess();
      // 찍히는 애니메이션이 끝날 때까지는 서비스가 기다리고, 화면을 떠나면 훅이 취소한다
      requestReviewAt('paw_print_celebration');
    }
  }, [
    celebratedCount,
    hasNewPawPrint,
    inviteService,
    myInvite.qualifiedCount,
    requestReviewAt,
    userId,
  ]);

  const handleBoardLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  return (
    <VStack className={cn('gap-4', className)} {...props}>
      <Text size="b4" weight="semibold" tone="brand" className="tabular-nums">
        {t('pawPrintBoard.header', {
          boardNumber: board.boardNumber,
          count: board.totalPawPrints,
          total: formatCount(board.totalPawPrints, dateFormatContext.locale),
        })}
      </Text>

      <Text size="b3" shade={7} lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
        {t('pawPrintBoard.rewardRule', {
          activeDays: InvitedFriendPolicy.requiredActiveDays(),
          days: InvitePolicy.nextPremiumDays(myInvite),
          slots: InvitePolicy.nextFriendSlots(myInvite),
          count: InvitePolicy.nextFriendSlots(myInvite),
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

      <Box className="rounded-2xl bg-gray-1 px-3.5 py-3">
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
          t('pawPrintBoard.firstHint', { activeDays: InvitedFriendPolicy.requiredActiveDays() }),
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
          <PressedPawPrint delay={newPawPrintOrder * NEW_PAW_PRINT_STAGGER_MS} />
        ))
        .with({ state: 'stamped', isNew: false }, () => <StaticPawPrint state="stamped" />)
        .with({ state: 'waiting' }, () => <WaitingPawPrint />)
        .with({ state: 'empty' }, () => <StaticPawPrint state="empty" isNext={cell.isNext} />)
        .with({ state: 'milestone' }, () => <InvitePawPrintBoard.Milestone />)
        .exhaustive()}
    </Box>
  );
};

/** 초대 보상으로 받은 것을 표시하는 장식 도장. 움직이지 않고 읽기 도구에서 숨긴다 */
InvitePawPrintBoard.Stamp = function Stamp({ className, ...props }: ComponentProps<typeof Box>) {
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className={pawPrintVariants({ state: 'stamped', className: cn('size-11', className) })}
      {...props}
    >
      <Box className="absolute inset-1 rounded-full border border-dashed border-white/90 dark:border-gray-1/90" />
      <PawIcon width={20} height={20} colorClassName={pawPrintIconVariants({ state: 'stamped' })} />
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
  /** 가로 생선 뼈 길이(pt). 판 격자가 정한다 */
  length?: number;
}

/** 발자국 사이를 잇는 생선 뼈. 찍힌 발자국 사이만 main 색으로 채운다 */
InvitePawPrintBoard.Connector = function Connector({
  isFilled,
  orientation = 'horizontal',
  length = MIN_CONNECTOR_LENGTH,
}: ConnectorProps) {
  const patternId = useId();
  const { color } = useResolveClassNames(fishBoneVariants({ isFilled }));
  const isHorizontal = orientation === 'horizontal';

  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={isHorizontal ? 'h-3' : 'h-[22px] w-3'}
      style={isHorizontal ? { width: length } : undefined}
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
  const { width: frameWidth } = useSafeAreaFrame();
  const { left: insetLeft, right: insetRight } = useSafeAreaInsets();
  // 불러온 판과 같은 격자로 자리를 잡아 내용이 들어와도 높이가 튀지 않는다
  const grid = calculatePawPrintGrid(
    calculatePawPrintBoardWidth({
      frameWidth,
      insetLeft,
      insetRight,
      maxContentWidth: READABLE_CONTENT_MAX_WIDTH,
    }),
  );

  return (
    <VStack gap={16} accessibilityState={{ busy: true }}>
      <TextSkeleton size="b4" className="w-44" />
      <TextSkeleton size="b3" className="w-64" />
      <VStack align="center" gap={22}>
        {times(PAW_PRINT_BOARD_SIZE / grid.columns, (rowIndex) => (
          <HStack key={rowIndex} style={{ width: grid.rowWidth, gap: grid.connectorLength }}>
            {times(grid.columns, (index) => (
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
      <Skeleton className="h-[66px] rounded-2xl" />
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

/** 새 발자국: 크게 떠 있다가 쿵 찍히고 테두리가 퍼진다. transform·opacity만 바꾼다 */
function PressedPawPrint({ delay }: { delay: number }) {
  const isReducedMotion = useReducedMotion();
  const press = useSharedValue(isReducedMotion ? 1 : 0);
  const burst = useSharedValue(isReducedMotion ? 1 : 0);

  useEffect(() => {
    if (isReducedMotion) {
      return;
    }

    press.set(withDelay(delay, withSpring(1, PAW_PRINT_PRESS_SPRING)));
    burst.set(
      withDelay(
        delay + 120,
        withTiming(1, {
          duration: 480,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );

    return () => {
      cancelAnimation(press);
      cancelAnimation(burst);
    };
  }, [burst, delay, isReducedMotion, press]);

  const pawPrintStyle = useAnimatedStyle(() => ({
    opacity: Math.min(press.get() * 2, 1),
    transform: [{ scale: 1.7 - press.get() * 0.7 }, { rotate: `${-20 + press.get() * 14}deg` }],
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.get() === 0 ? 0 : 0.55 * (1 - burst.get()),
    transform: [{ scale: 0.7 + burst.get() * 0.85 }],
  }));

  return (
    <Box className="flex-1">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, burstStyle]}>
        <Box className="flex-1 rounded-full border-2 border-main" />
      </Animated.View>
      <Animated.View style={[styles.fill, pawPrintStyle]}>
        <StaticPawPrint state="stamped" />
      </Animated.View>
    </Box>
  );
}

/** 기다리는 발자국은 가끔 살짝 흔들려 곧 찍힐 것을 알린다 */
function WaitingPawPrint() {
  const isReducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isReducedMotion) {
      return;
    }

    const step = { duration: 190, reduceMotion: ReduceMotion.System };
    rotation.set(
      withRepeat(
        withSequence(
          withDelay(1700, withTiming(-7, step)),
          withTiming(6, step),
          withTiming(-3, step),
          withTiming(0, step),
        ),
        -1,
      ),
    );

    return () => cancelAnimation(rotation);
  }, [isReducedMotion, rotation]);

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
  const [{ data: myInvite }, { data: me }] = useSuspenseQueries({
    queries: [useGetInviteQueryOptions(), useGetMeQueryOptions()],
  });
  const remaining = InvitePolicy.remainingToNextMilestone(myInvite);

  return match(InvitePolicy.progress(myInvite))
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
            windowDays: InvitePolicy.premiumCapWindowDays(),
            days: InvitePolicy.monthlyPremiumCapDays(),
          })}
        </Text>
        <KeepPremiumButton premiumAccess={me.premiumAccess} />
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
            days: InvitePolicy.totalPremiumCapDays(),
          })}
        </Text>
        <KeepPremiumButton premiumAccess={me.premiumAccess} />
      </VStack>
    ))
    .with('in-progress', () => (
      <VStack gap={2}>
        <Text size="b4" weight="semibold" shade={8} className="tabular-nums">
          {t('pawPrintBoard.rewardsSummary', {
            count: InvitePolicy.earnedPremiumDays(myInvite),
            slots: InvitePolicy.earnedFriendSlots(myInvite),
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
function KeepPremiumButton({ premiumAccess }: { premiumAccess: PremiumAccess }) {
  const { t } = useTranslation('invite');
  const navigate = useSingleTap(router.navigate);

  if (PremiumAccessPolicy.isStoreSubscribed(premiumAccess)) {
    return null;
  }

  return (
    <Button
      variant="weak"
      size="medium"
      display="inline"
      accessibilityHint={t('pawPrintBoard.keepPremiumHint')}
      onPress={() => navigate('/settings/subscription')}
    >
      {t('pawPrintBoard.keepPremium')}
    </Button>
  );
}
