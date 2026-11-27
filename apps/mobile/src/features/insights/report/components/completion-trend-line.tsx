import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Path,
  Skia,
  type SkPathBuilder,
  type SkRect,
} from '@shopify/react-native-skia';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { ANIMATION } from '@src/shared/constants/animation';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useRebuiltPath } from '@src/shared/hooks/use-rebuilt-path';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { AspectRatio, Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { formatPercent } from '@src/shared/utils/number-format';
import { clamp } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { useDeferredValue, useEffect } from 'react';
import type { AccessibilityActionEvent, LayoutChangeEvent, ViewStyle } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  CHART_LABEL_GAP_PT,
  CHART_PAN_ACTIVE_OFFSET_X_PT,
  CHART_PAN_FAIL_OFFSET_Y_PT,
  CHART_REVEAL_EASING,
  CHART_TAP_MAX_DISTANCE_PT,
} from '../constants/report-chart.constants';
import {
  toCompletionTrend,
  toTrendPointIndex,
  type TrendGuide,
  type TrendPoint,
  type TrendView,
} from '../utils/completion-trend.geometry';

// 차트와 .Loading이 같은 비율을 써야 받은 뒤 자리가 움직이지 않는다
const COMPLETION_TREND_ASPECT_RATIO = 3;
/** 폭이 가장 좁은 SE의 큰 글꼴에서도 라벨이 들어가는 고정 좌표계이고, 폭에 비례해 늘어난다 */
const COMPLETION_TREND_VIEW = {
  width: 240,
  height: 240 / COMPLETION_TREND_ASPECT_RATIO,
  insetLeft: 34,
  insetRight: 10,
  insetTop: 22,
  insetBottom: 8,
} as const satisfies TrendView;
const ACCESSIBILITY_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];
const LINE_WIDTH = 2.5;
const POINT_RADIUS = 4;
const POINT_HALO_RADIUS = 8;
const GUIDE_DASH_LENGTHS_PT = [3, 4];
/** 값 라벨과 점 사이(view 좌표) */
const VALUE_LABEL_GAP = 6;
const PLOT_START_PERCENT = (COMPLETION_TREND_VIEW.insetLeft / COMPLETION_TREND_VIEW.width) * 100;

interface CompletionTrendLineProps {
  /** 오래된 주부터 주마다의 완료율(0~100) */
  values: readonly number[];
  /** 주마다의 라벨. 처음·끝은 x축에 쓰고 고른 주는 스크린 리더가 읽는다 */
  labels: readonly string[];
  /** 고르지 않으면 가장 최근 주를 강조한다 */
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number) => void;
  accessibilityLabel: string;
  className?: string;
  testID?: string;
}

export function CompletionTrendLine({
  values,
  labels,
  selectedIndex,
  onSelectedIndexChange,
  accessibilityLabel,
  className,
  testID,
}: CompletionTrendLineProps) {
  const { t } = useTranslation('ai');
  const haptics = useHaptics();
  const { locale } = useDateFormatContext();
  const isAnimationActive = useIsAnimationActive();
  const lineColor = useResolvedColor('text-main');
  const areaColor = useResolvedColor('text-main/10');
  const haloColor = useResolvedColor('text-main/20');
  const guideColor = useResolvedColor('text-gray-4');
  const width = useSharedValue(0);
  const reveal = useSharedValue(isAnimationActive ? 0 : 1);
  const touchedIndex = useSharedValue<number | null>(null);
  const deferredValues = useDeferredValue(values);
  const pointCount = deferredValues.length;
  const trend = toCompletionTrend(deferredValues, COMPLETION_TREND_VIEW);
  const highlightedIndex = clamp(selectedIndex ?? pointCount - 1, 0, Math.max(0, pointCount - 1));
  const highlightedPoint = trend?.points[highlightedIndex] ?? null;
  const highlightedRate = formatPercent(deferredValues[highlightedIndex] ?? 0, locale);

  const readScale = () => {
    'worklet';
    return width.get() / COMPLETION_TREND_VIEW.width;
  };
  const linePath = useRebuiltPath(readScale, (builder, scale) => {
    'worklet';
    if (trend != null) {
      addScaledSvgPath(builder, trend.line, scale);
    }
  });
  const areaPath = useRebuiltPath(readScale, (builder, scale) => {
    'worklet';
    if (trend != null) {
      addScaledSvgPath(builder, trend.area, scale);
    }
  });
  const guidePath = useRebuiltPath(readScale, (builder, scale) => {
    'worklet';
    if (trend != null) {
      const right = COMPLETION_TREND_VIEW.width * scale;
      builder.moveTo(0, trend.guides.upper.y * scale).lineTo(right, trend.guides.upper.y * scale);
      builder.moveTo(0, trend.guides.lower.y * scale).lineTo(right, trend.guides.lower.y * scale);
    }
  });
  const highlightedCenter = useDerivedValue(() => {
    // 매퍼는 바로 품은 shared value만 입력으로 잡아 readScale을 거치면 폭을 잰 뒤에도 점이 (0, 0)에 남는다
    const scale = width.get() / COMPLETION_TREND_VIEW.width;
    return { x: (highlightedPoint?.x ?? 0) * scale, y: (highlightedPoint?.y ?? 0) * scale };
  });
  const revealClip = useDerivedValue((): SkRect => {
    const chartWidth = width.get();
    return {
      x: 0,
      y: 0,
      width: chartWidth * reveal.get(),
      height: chartWidth / COMPLETION_TREND_ASPECT_RATIO,
    };
  });

  useEffect(() => {
    if (!isAnimationActive) {
      reveal.set(1);
      return;
    }
    reveal.set(
      withTiming(1, { duration: ANIMATION.durationMs.emphasis, easing: CHART_REVEAL_EASING }),
    );
    return () => cancelAnimation(reveal);
  }, [isAnimationActive, reveal]);

  // worklet이 만들 때 잡아 두므로 제스처보다 먼저 둔다
  const handleSelect = (index: number) => {
    if (index === selectedIndex) {
      return;
    }
    haptics.selection();
    onSelectedIndexChange(index);
  };

  useAnimatedReaction(
    () => touchedIndex.get(),
    (index, previousIndex) => {
      if (index != null && index !== previousIndex) {
        scheduleOnRN(handleSelect, index);
      }
    },
  );
  const pan = usePanGesture({
    activeOffsetX: [-CHART_PAN_ACTIVE_OFFSET_X_PT, CHART_PAN_ACTIVE_OFFSET_X_PT],
    failOffsetY: [-CHART_PAN_FAIL_OFFSET_Y_PT, CHART_PAN_FAIL_OFFSET_Y_PT],
    onActivate: (event) => {
      'worklet';
      touchedIndex.set(toTrendPointIndex(event.x, width.get(), COMPLETION_TREND_VIEW, pointCount));
    },
    onUpdate: (event) => {
      'worklet';
      touchedIndex.set(toTrendPointIndex(event.x, width.get(), COMPLETION_TREND_VIEW, pointCount));
    },
    onFinalize: () => {
      'worklet';
      touchedIndex.set(null);
    },
  });
  const tap = useTapGesture({
    maxDistance: CHART_TAP_MAX_DISTANCE_PT,
    onActivate: (event) => {
      'worklet';
      scheduleOnRN(
        handleSelect,
        toTrendPointIndex(event.x, width.get(), COMPLETION_TREND_VIEW, pointCount),
      );
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    width.set(nativeEvent.layout.width);
  };

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    const step = nativeEvent.actionName === 'increment' ? 1 : -1;
    handleSelect(clamp(highlightedIndex + step, 0, pointCount - 1));
  };

  return (
    <VStack gap={CHART_LABEL_GAP_PT} className={className} testID={testID}>
      <GestureDetector gesture={gesture}>
        <AspectRatio
          ratio={COMPLETION_TREND_ASPECT_RATIO}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{
            text: t('report.latest.trendWeek', {
              week: labels[highlightedIndex] ?? '',
              rate: highlightedRate,
            }),
          }}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          onAccessibilityAction={handleAccessibilityAction}
          onLayout={handleLayout}
          // 리포트 카드(Link)의 Pressable이 차트 탭을 카드 누름으로 받아 상세로 가지 않게 터치 응답자를 차지한다. 탭·밀기는 Gesture Handler가 받는다
          onStartShouldSetResponder={() => true}
        >
          <Canvas style={{ flex: 1 }}>
            <Path path={guidePath} style="stroke" strokeWidth={1} color={guideColor}>
              <DashPathEffect intervals={GUIDE_DASH_LENGTHS_PT} />
            </Path>
            <Group clip={revealClip}>
              <Path path={areaPath} color={areaColor} />
              <Path
                path={linePath}
                color={lineColor}
                style="stroke"
                strokeWidth={LINE_WIDTH}
                strokeCap="round"
                strokeJoin="round"
              />
              {trend != null && (
                <Group>
                  <Circle c={highlightedCenter} r={POINT_HALO_RADIUS} color={haloColor} />
                  <Circle c={highlightedCenter} r={POINT_RADIUS} color={lineColor} />
                </Group>
              )}
            </Group>
          </Canvas>
          {/* 그림 위 글자는 view 좌표의 비율로 놓아 폭을 재지 않고도 점·기준선과 맞는다 */}
          {trend != null && (
            <>
              <GuideLabel guide={trend.guides.upper} />
              <GuideLabel guide={trend.guides.lower} />
            </>
          )}
          {highlightedPoint != null && (
            <Box
              pointerEvents="none"
              className="absolute"
              style={toValueLabelPosition(highlightedPoint, {
                isFirst: highlightedIndex === 0,
                isLast: highlightedIndex === pointCount - 1,
              })}
            >
              <Text size="b4" weight="bold" shade={9} numberOfLines={1} className="tabular-nums">
                {highlightedRate}
              </Text>
            </Box>
          )}
        </AspectRatio>
      </GestureDetector>
      <HStack justify="between" style={{ paddingLeft: `${PLOT_START_PERCENT}%` }}>
        <Text size="e1" numberOfLines={1} className="text-gray-5 tabular-nums">
          {labels[0]}
        </Text>
        <Text size="e1" numberOfLines={1} className="text-gray-5 tabular-nums">
          {labels.at(-1)}
        </Text>
      </HStack>
    </VStack>
  );
}

CompletionTrendLine.Loading = function Loading({ className }: { className?: string }) {
  return (
    <VStack gap={CHART_LABEL_GAP_PT} className={className}>
      <AspectRatio ratio={COMPLETION_TREND_ASPECT_RATIO}>
        <Skeleton className="flex-1 rounded-xl dark:bg-gray-2" />
      </AspectRatio>
      <TextSkeleton size="e1" />
    </VStack>
  );
};

/** 기록이 없는 주에도 차트와 같은 높이를 남겨 아래 자리가 움직이지 않게 한다 */
CompletionTrendLine.Empty = function Empty({ message }: { message: string }) {
  return (
    <VStack gap={CHART_LABEL_GAP_PT}>
      <AspectRatio ratio={COMPLETION_TREND_ASPECT_RATIO}>
        <Box className="flex-1 items-center justify-center rounded-xl bg-gray-1">
          <Text size="b4" shade={6}>
            {message}
          </Text>
        </Box>
      </AspectRatio>
      <Text size="e1" className="opacity-0" accessibilityElementsHidden>
        {' '}
      </Text>
    </VStack>
  );
};

/** 기준선 왼쪽 끝 위의 완료율. 점은 왼쪽 여백(insetLeft) 오른쪽에만 있어 겹치지 않는다 */
function GuideLabel({ guide }: { guide: TrendGuide }) {
  const { locale } = useDateFormatContext();

  return (
    <Box
      pointerEvents="none"
      className="absolute left-0"
      style={{ bottom: toPercent(COMPLETION_TREND_VIEW.height - guide.y, 'height') }}
    >
      <Text size="e1" numberOfLines={1} className="text-gray-5 tabular-nums">
        {formatPercent(guide.rate, locale)}
      </Text>
    </Box>
  );
}

// 경로 문자열은 고정 좌표계라 폭이 바뀔 때 늘린다. 옮겨 담은 임시 경로는 바로 놓는다
function addScaledSvgPath(builder: SkPathBuilder, svgPath: string, scale: number) {
  'worklet';
  const source = Skia.Path.MakeFromSVGString(svgPath);
  if (source == null) {
    return;
  }
  builder.addPath(source);
  source.dispose();
  builder.transform([scale, 0, 0, 0, scale, 0, 0, 0, 1]);
}

function toPercent(viewLength: number, axis: 'width' | 'height'): `${number}%` {
  return `${(viewLength / COMPLETION_TREND_VIEW[axis]) * 100}%`;
}

/** 글자 폭을 재지 않고 가운데를 맞추려고 점을 가운데에 둔 상자를 만든다. 첫·끝 점은 겹치지 않게 그쪽 끝에 붙인다 */
function toValueLabelPosition(
  point: TrendPoint,
  { isFirst, isLast }: { isFirst: boolean; isLast: boolean },
): ViewStyle {
  const bottom = toPercent(COMPLETION_TREND_VIEW.height - point.y + VALUE_LABEL_GAP, 'height');
  if (isLast) {
    return { bottom, right: 0 };
  }
  if (isFirst) {
    return { bottom, left: toPercent(point.x - POINT_RADIUS, 'width') };
  }
  const halfWidth = Math.min(point.x, COMPLETION_TREND_VIEW.width - point.x);
  return {
    bottom,
    left: toPercent(point.x - halfWidth, 'width'),
    width: toPercent(halfWidth * 2, 'width'),
    alignItems: 'center',
  };
}
