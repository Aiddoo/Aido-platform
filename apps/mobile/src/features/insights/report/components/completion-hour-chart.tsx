import { Canvas, Group, Path, type SkRect } from '@shopify/react-native-skia';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { ANIMATION } from '@src/shared/constants/animation';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useRebuiltPath } from '@src/shared/hooks/use-rebuilt-path';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { AspectRatio, Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { clamp, range } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { useDeferredValue, useEffect } from 'react';
import type { AccessibilityActionEvent, AccessibilityValue, LayoutChangeEvent } from 'react-native';
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
  CHART_REVEAL_EASING,
  HOUR_CHART_ASPECT_RATIO,
  HOUR_CHART_BAR,
} from '../constants/report-chart.constants';
import { toBarIndex, toBarRects } from '../utils/bar-chart.geometry';

const ACCESSIBILITY_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];
// 세로 스크롤과 다투지 않게 가로로 먼저 움직일 때만 밀기로 잡고, 세로로 먼저 움직이면 스크롤에 넘긴다
const PAN_ACTIVE_OFFSET_X = 8;
const PAN_FAIL_OFFSET_Y = 12;
const TICK_STEP_CHOICES_HOURS = [3, 6];
const WIDEST_TICK_STEP_HOURS = 12;
const TICK_LABEL_MIN_WIDTH_PT = 56;

interface CompletionHourChartProps {
  values: readonly number[];
  labels: readonly string[];
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number) => void;
  accessibilityLabel: string;
  accessibilityValue?: AccessibilityValue;
  className?: string;
  testID?: string;
}

export function CompletionHourChart({
  values,
  labels,
  selectedIndex,
  onSelectedIndexChange,
  accessibilityLabel,
  accessibilityValue,
  className,
  testID,
}: CompletionHourChartProps) {
  const haptics = useHaptics();
  const isAnimationActive = useIsAnimationActive();
  const [layoutSize, handleLabelLayout] = useLayoutSize();
  const trackColor = useResolvedColor('text-gray-3');
  const fillColor = useResolvedColor('text-main/40');
  const selectedColor = useResolvedColor('text-main');
  const width = useSharedValue(0);
  const reveal = useSharedValue(isAnimationActive ? 0 : 1);
  const touchedIndex = useSharedValue<number | null>(null);
  const deferredValues = useDeferredValue(values);
  const barCount = deferredValues.length;
  const tickStepHours =
    TICK_STEP_CHOICES_HOURS.find(
      (stepHours) => TICK_LABEL_MIN_WIDTH_PT <= ((layoutSize?.width ?? 0) * stepHours) / barCount,
    ) ?? WIDEST_TICK_STEP_HOURS;

  const bars = useDerivedValue(() => {
    const chartWidth = width.get();
    return toBarRects(
      deferredValues.map((count) => ({ total: count, completed: count })),
      chartWidth,
      chartWidth / HOUR_CHART_ASPECT_RATIO,
      HOUR_CHART_BAR,
    );
  });
  const readBars = () => {
    'worklet';
    return bars.get();
  };
  const trackPath = useRebuiltPath(readBars, (builder, rects) => {
    'worklet';
    rects.forEach((bar) => {
      builder.addRRect(bar.track);
    });
  });
  const fillPath = useRebuiltPath(readBars, (builder, rects) => {
    'worklet';
    rects.forEach((bar) => {
      builder.addRect(bar.fill);
    });
  });
  const selectedFillPath = useRebuiltPath(readBars, (builder, rects) => {
    'worklet';
    const selected = selectedIndex == null ? null : rects[selectedIndex];
    if (selected != null) {
      builder.addRect(selected.fill);
    }
  });
  const revealClip = useDerivedValue((): SkRect => {
    const chartWidth = width.get();
    const chartHeight = chartWidth / HOUR_CHART_ASPECT_RATIO;
    const visibleHeight = chartHeight * reveal.get();
    return { x: 0, y: chartHeight - visibleHeight, width: chartWidth, height: visibleHeight };
  });

  useEffect(() => {
    if (!isAnimationActive) {
      reveal.set(1);
      return;
    }
    reveal.set(withTiming(1, { duration: ANIMATION.durationMs.slow, easing: CHART_REVEAL_EASING }));
    return () => cancelAnimation(reveal);
  }, [isAnimationActive, reveal]);

  // worklet이 만들 때 잡아 두므로 제스처보다 먼저 둔다. 지난 렌더의 선택 값과 비교하면 빠른 밀기에서 칸을 놓친다
  const handleSelect = (index: number) => {
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
    activeOffsetX: [-PAN_ACTIVE_OFFSET_X, PAN_ACTIVE_OFFSET_X],
    failOffsetY: [-PAN_FAIL_OFFSET_Y, PAN_FAIL_OFFSET_Y],
    onActivate: (event) => {
      'worklet';
      touchedIndex.set(toBarIndex(event.x, width.get(), barCount));
    },
    onUpdate: (event) => {
      'worklet';
      touchedIndex.set(toBarIndex(event.x, width.get(), barCount));
    },
    onFinalize: () => {
      'worklet';
      touchedIndex.set(null);
    },
  });
  const tap = useTapGesture({
    onActivate: (event) => {
      'worklet';
      scheduleOnRN(handleSelect, toBarIndex(event.x, width.get(), barCount));
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    width.set(nativeEvent.layout.width);
  };

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    const step = nativeEvent.actionName === 'increment' ? 1 : -1;
    handleSelect(selectedIndex == null ? 0 : clamp(selectedIndex + step, 0, barCount - 1));
  };

  return (
    <VStack gap={CHART_LABEL_GAP_PT} className={className} testID={testID}>
      <GestureDetector gesture={gesture}>
        <AspectRatio
          ratio={HOUR_CHART_ASPECT_RATIO}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={accessibilityValue}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          onAccessibilityAction={handleAccessibilityAction}
          onLayout={handleLayout}
        >
          <Canvas style={{ flex: 1 }}>
            <Group clip={revealClip}>
              <Path path={trackPath} color={trackColor} />
              <Group clip={trackPath}>
                <Path path={fillPath} color={fillColor} />
                <Path path={selectedFillPath} color={selectedColor} />
              </Group>
            </Group>
          </Canvas>
        </AspectRatio>
      </GestureDetector>
      <HStack onLayout={handleLabelLayout}>
        {/* 눈금마다 같은 수의 칸을 묶어 라벨이 그 시각 칸의 왼쪽 끝에 놓인다 */}
        {range(0, labels.length, tickStepHours).map((hour) => (
          <Box key={hour} flex={1}>
            <Text size="e1" numberOfLines={1} className="text-gray-5 tabular-nums">
              {labels[hour]}
            </Text>
          </Box>
        ))}
      </HStack>
    </VStack>
  );
}

CompletionHourChart.Loading = function Loading({ className }: { className?: string }) {
  return (
    <VStack gap={CHART_LABEL_GAP_PT} className={className}>
      <AspectRatio ratio={HOUR_CHART_ASPECT_RATIO}>
        <Skeleton className="flex-1 rounded-xl dark:bg-gray-2" />
      </AspectRatio>
      <TextSkeleton size="e1" />
    </VStack>
  );
};
