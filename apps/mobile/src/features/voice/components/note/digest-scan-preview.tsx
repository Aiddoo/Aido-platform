import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { type ComponentProps, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const BEAM = { height: 90, opacity: 0.45, durationMs: 2_200 } as const;

interface DigestScanPreviewProps extends Omit<ComponentProps<typeof Box>, 'children' | 'onLayout'> {
  paragraphs: readonly string[];
}

export function DigestScanPreview({ paragraphs, className, ...boxProps }: DigestScanPreviewProps) {
  const isReducedMotion = useIsReduceMotionEnabled();
  const beamColor = useResolvedColor('text-main');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const offset = useSharedValue(-BEAM.height);

  useEffect(() => {
    if (isReducedMotion || size.height === 0) {
      return;
    }
    offset.set(-BEAM.height);
    offset.set(
      withRepeat(
        withTiming(size.height, { duration: BEAM.durationMs, easing: Easing.inOut(Easing.quad) }),
        -1,
      ),
    );

    return () => cancelAnimation(offset);
  }, [isReducedMotion, size.height, offset]);

  const transform = useDerivedValue(() => [{ translateY: offset.get() }]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  return (
    <Box
      className={cn('overflow-hidden rounded-2xl bg-gray-1 p-4', className)}
      onLayout={handleLayout}
      {...boxProps}
    >
      {paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          size="b4"
          shade={6}
          lineBreakStrategyIOS="hangul-word"
          className="mb-2 opacity-60"
        >
          {paragraph}
        </Text>
      ))}
      {!isReducedMotion && (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Group transform={transform} opacity={BEAM.opacity}>
            <Rect x={0} y={0} width={size.width} height={BEAM.height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, BEAM.height)}
                colors={['transparent', beamColor, 'transparent']}
              />
            </Rect>
          </Group>
        </Canvas>
      )}
    </Box>
  );
}
