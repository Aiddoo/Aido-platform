import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { type ComponentProps, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useSkiaColor } from '../../hooks/use-skia-color';

const BEAM = { height: 90, opacity: 0.45, durationMs: 2_200 } as const;

interface DigestScanPreviewProps extends Omit<ComponentProps<typeof Box>, 'children' | 'onLayout'> {
  /** 정리할 글자를 문단으로 나눈 것. 흐리게 보이고 그 위로 빛줄기가 훑는다 */
  paragraphs: readonly string[];
}

/** 정리 중에 전사 글자를 흐리게 보여주며 위에서 아래로 빛줄기가 훑는다. 모션 줄이기에서는 빛줄기를 그리지 않는다 */
export function DigestScanPreview({ paragraphs, className, ...boxProps }: DigestScanPreviewProps) {
  const reduceMotion = useReduceMotion();
  const beamColor = useSkiaColor('text-main');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const offset = useSharedValue(-BEAM.height);

  useEffect(() => {
    if (reduceMotion || size.height === 0) {
      return;
    }
    offset.set(-BEAM.height);
    offset.set(
      withRepeat(
        withTiming(size.height, { duration: BEAM.durationMs, easing: Easing.inOut(Easing.quad) }),
        -1,
      ),
    );
  }, [reduceMotion, size.height, offset]);

  const transform = useDerivedValue(() => [{ translateY: offset.get() }]);

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  return (
    <Box
      className={cn('overflow-hidden rounded-2xl bg-gray-1 p-3.5', className)}
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
      {!reduceMotion && (
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
