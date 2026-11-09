import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { cn } from '@src/shared/utils/cn';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Box } from '../box';

const STAMP_PRESS_SPRING = { duration: 400, dampingRatio: 0.55, reduceMotion: ReduceMotion.System };
/** 크게 떠 있다가(1.7배, -20°) 찍히며 제자리(1배, -6°)로 온다 */
const STAMP_LIFTED = { scale: 1.7, rotateDeg: -20, rotateTravelDeg: 14 } as const;
/** 찍힌 뒤 delayMs 만에 테두리가 퍼지기 시작해 durationMs 동안 커지며 사라진다 */
const STAMP_BURST = {
  delayMs: 120,
  durationMs: 480,
  startScale: 0.7,
  growScale: 0.85,
  peakOpacity: 0.55,
} as const;

/** 동작 줄이기면 찍힌 모습에서 시작해 움직이지 않는다 */
export function getStampPressStartProgress(isReducedMotion: boolean): number {
  return isReducedMotion ? 1 : 0;
}

export interface StampPressProps {
  /** 처음 그릴 때 한 번 찍는다. 다시 찍으려면 쓰는 쪽이 key를 바꿔 새로 그린다 */
  children: ReactNode;
  /** 여러 도장을 차례로 찍을 때 늦출 시간(ms) */
  delay?: number;
  /** 퍼지는 테두리 모양. 기본은 main 색 둥근 테두리 */
  burstClassName?: string;
  className?: string;
}

/** 도장이 쿵 찍히고 테두리가 한 번 퍼진다. transform·opacity만 UI 스레드에서 바꾸고, 사라지면 멈춘다 */
export function StampPress({ children, delay = 0, burstClassName, className }: StampPressProps) {
  const isReducedMotion = useIsReduceMotionEnabled();
  const press = useSharedValue(getStampPressStartProgress(isReducedMotion));
  const burst = useSharedValue(getStampPressStartProgress(isReducedMotion));

  useEffect(() => {
    if (isReducedMotion) {
      press.set(1);
      burst.set(1);
      return;
    }

    press.set(withDelay(delay, withSpring(1, STAMP_PRESS_SPRING)));
    burst.set(
      withDelay(
        delay + STAMP_BURST.delayMs,
        withTiming(1, {
          duration: STAMP_BURST.durationMs,
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

  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(press.get() * 2, 1),
    transform: [
      { scale: STAMP_LIFTED.scale - press.get() * (STAMP_LIFTED.scale - 1) },
      { rotate: `${STAMP_LIFTED.rotateDeg + press.get() * STAMP_LIFTED.rotateTravelDeg}deg` },
    ],
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.get() === 0 ? 0 : STAMP_BURST.peakOpacity * (1 - burst.get()),
    transform: [{ scale: STAMP_BURST.startScale + burst.get() * STAMP_BURST.growScale }],
  }));

  return (
    <Box className={className}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, burstStyle]}>
        <Box className={cn('flex-1 rounded-full border-2 border-main', burstClassName)} />
      </Animated.View>
      <Animated.View style={[styles.stamp, stampStyle]}>{children}</Animated.View>
    </Box>
  );
}

const styles = StyleSheet.create({
  stamp: { flexGrow: 1 },
});
