import { Canvas, Group, Path, type SkRect } from '@shopify/react-native-skia';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { ANIMATION } from '@src/shared/constants/animation';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useRebuiltPath } from '@src/shared/hooks/use-rebuilt-path';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { AspectRatio, Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { clamp } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { useDeferredValue, useEffect } from 'react';
import type { AccessibilityActionEvent, AccessibilityValue, LayoutChangeEvent } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  CHART_LABEL_GAP_PT,
  CHART_REVEAL_EASING,
  CHART_TAP_MAX_DISTANCE_PT,
} from '../constants/report-chart.constants';
import { type BarShape, toBarIndex, toBarRects } from '../utils/bar-chart.geometry';

const ACCESSIBILITY_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];
// 차트와 .Loading이 같은 비율을 써야 받은 뒤 자리가 움직이지 않는다
const DAILY_CHART_ASPECT_RATIO = 3;
const DAILY_CHART_BAR = {
  widthRatio: 0.55,
  cornerRadius: 8,
  minHeight: 4,
} as const satisfies BarShape;

interface DailyCompletionChartProps {
  values: readonly { total: number; completed: number; isUpcoming?: boolean }[];
  labels: readonly string[];
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number) => void;
  accessibilityLabel: string;
  accessibilityValue?: AccessibilityValue;
  className?: string;
  testID?: string;
}

export function DailyCompletionChart({
  values,
  labels,
  selectedIndex,
  onSelectedIndexChange,
  accessibilityLabel,
  accessibilityValue,
  className,
  testID,
}: DailyCompletionChartProps) {
  const haptics = useHaptics();
  const isAnimationActive = useIsAnimationActive();
  const trackColor = useResolvedColor('text-gray-3');
  const upcomingTrackColor = useResolvedColor('text-gray-2');
  const fillColor = useResolvedColor('text-main/40');
  const selectedColor = useResolvedColor('text-main');
  const width = useSharedValue(0);
  const reveal = useSharedValue(isAnimationActive ? 0 : 1);
  const deferredValues = useDeferredValue(values);
  const barCount = deferredValues.length;

  const bars = useDerivedValue(() => {
    const chartWidth = width.get();
    return toBarRects(
      deferredValues,
      chartWidth,
      chartWidth / DAILY_CHART_ASPECT_RATIO,
      DAILY_CHART_BAR,
    );
  });
  const readBars = () => {
    'worklet';
    return bars.get();
  };
  const trackPath = useRebuiltPath(readBars, (builder, rects) => {
    'worklet';
    for (const [index, bar] of rects.entries()) {
      if (deferredValues[index]?.isUpcoming !== true) {
        builder.addRRect(bar.track);
      }
    }
  });
  const upcomingTrackPath = useRebuiltPath(readBars, (builder, rects) => {
    'worklet';
    for (const [index, bar] of rects.entries()) {
      if (deferredValues[index]?.isUpcoming === true) {
        builder.addRRect(bar.track);
      }
    }
  });
  const fillPath = useRebuiltPath(readBars, (builder, rects) => {
    'worklet';
    for (const bar of rects) {
      builder.addRect(bar.fill);
    }
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
    const chartHeight = chartWidth / DAILY_CHART_ASPECT_RATIO;
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

  // 탭 worklet이 만들어질 때 이 함수를 잡아 두므로 제스처보다 먼저 둔다
  const handleSelect = (index: number) => {
    if (index === selectedIndex) {
      return;
    }
    haptics.selection();
    onSelectedIndexChange(index);
  };

  const tap = useTapGesture({
    maxDistance: CHART_TAP_MAX_DISTANCE_PT,
    onActivate: (event) => {
      'worklet';
      scheduleOnRN(handleSelect, toBarIndex(event.x, width.get(), barCount));
    },
  });

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    width.set(nativeEvent.layout.width);
  };

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    const step = nativeEvent.actionName === 'increment' ? 1 : -1;
    handleSelect(selectedIndex == null ? 0 : clamp(selectedIndex + step, 0, barCount - 1));
  };

  return (
    <VStack gap={CHART_LABEL_GAP_PT} className={className} testID={testID}>
      <GestureDetector gesture={tap}>
        <AspectRatio
          ratio={DAILY_CHART_ASPECT_RATIO}
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
              <Path path={upcomingTrackPath} color={upcomingTrackColor} />
              <Group clip={trackPath}>
                <Path path={fillPath} color={fillColor} />
                <Path path={selectedFillPath} color={selectedColor} />
              </Group>
            </Group>
          </Canvas>
        </AspectRatio>
      </GestureDetector>
      <HStack>
        {/* 막대 칸과 같은 폭으로 나눈다. 좁은 칸(월간)에서도 잘리지 않게 글자 상자가 칸보다 넓다 */}
        {labels.map((label, index) => (
          <Box key={index} flex={1} className="items-center">
            <Text
              size="e1"
              numberOfLines={1}
              className={cn(
                'w-12 text-center text-gray-5 tabular-nums',
                values[index]?.isUpcoming === true && 'text-gray-4',
                index === selectedIndex && 'text-gray-9',
              )}
            >
              {label}
            </Text>
          </Box>
        ))}
      </HStack>
    </VStack>
  );
}

DailyCompletionChart.Loading = function Loading({ className }: { className?: string }) {
  return (
    <VStack gap={CHART_LABEL_GAP_PT} className={className}>
      <AspectRatio ratio={DAILY_CHART_ASPECT_RATIO}>
        <Skeleton className="flex-1 rounded-xl dark:bg-gray-2" />
      </AspectRatio>
      <TextSkeleton size="e1" />
    </VStack>
  );
};
