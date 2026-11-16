import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  type SkPathBuilder,
  type SkRect,
} from '@shopify/react-native-skia';
import { ANIMATION } from '@src/shared/constants/animation';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useRebuiltPath } from '@src/shared/hooks/use-rebuilt-path';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { AspectRatio, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { Skeleton } from 'heroui-native';
import { useDeferredValue, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  CHART_LABEL_GAP_PT,
  CHART_REVEAL_EASING,
  COMPLETION_TREND_ASPECT_RATIO,
  COMPLETION_TREND_VIEW,
} from '../constants/report-chart.constants';
import { toCompletionTrend } from '../utils/completion-trend.geometry';

const LINE_WIDTH = 2.5;
const END_DOT_RADIUS = 4;
const END_HALO_RADIUS = 8;

interface CompletionTrendLineProps {
  /** 오래된 주부터 주마다의 완료율(0~100) */
  values: readonly number[];
  startLabel: string;
  endLabel: string;
  accessibilityLabel: string;
  className?: string;
  testID?: string;
}

export function CompletionTrendLine({
  values,
  startLabel,
  endLabel,
  accessibilityLabel,
  className,
  testID,
}: CompletionTrendLineProps) {
  const isAnimationActive = useIsAnimationActive();
  const lineColor = useResolvedColor('text-main');
  const areaColor = useResolvedColor('text-main/10');
  const haloColor = useResolvedColor('text-main/20');
  const width = useSharedValue(0);
  const reveal = useSharedValue(isAnimationActive ? 0 : 1);
  const deferredValues = useDeferredValue(values);
  const trend = toCompletionTrend(deferredValues, COMPLETION_TREND_VIEW);

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
  const endPoint = useDerivedValue(() => {
    const scale = readScale();
    return { x: (trend?.end.x ?? 0) * scale, y: (trend?.end.y ?? 0) * scale };
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

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    width.set(nativeEvent.layout.width);
  };

  return (
    <VStack
      gap={CHART_LABEL_GAP_PT}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className={className}
      testID={testID}
    >
      <AspectRatio ratio={COMPLETION_TREND_ASPECT_RATIO} onLayout={handleLayout}>
        <Canvas style={{ flex: 1 }}>
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
                <Circle c={endPoint} r={END_HALO_RADIUS} color={haloColor} />
                <Circle c={endPoint} r={END_DOT_RADIUS} color={lineColor} />
              </Group>
            )}
          </Group>
        </Canvas>
      </AspectRatio>
      <HStack justify="between">
        <Text size="e1" numberOfLines={1} className="text-gray-5 tabular-nums">
          {startLabel}
        </Text>
        <Text size="e1" numberOfLines={1} className="text-gray-5 tabular-nums">
          {endLabel}
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
