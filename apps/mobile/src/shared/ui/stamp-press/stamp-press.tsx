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

/**
 * `stamp`: 크게 떠 있다가(1.7배, -20°) 쿵 찍히며 제자리(1배, -6°)로 온다.
 * `rise`: 살짝 작게(0.9배) 있다가 부드럽게 제 크기로 떠오른다(결제 완료 왕관).
 */
const STAMP_MOTIONS = {
  stamp: {
    spring: { duration: 400, dampingRatio: 0.55 },
    scale: 1.7,
    rotateDeg: -20,
    rotateTravelDeg: 14,
  },
  rise: {
    spring: { duration: 400, dampingRatio: 0.8 },
    scale: 0.9,
    rotateDeg: 0,
    rotateTravelDeg: 0,
  },
} as const;
type StampMotion = keyof typeof STAMP_MOTIONS;
/** 찍힌 뒤 delayMs 만에 테두리가 퍼지기 시작해 durationMs 동안 커지며 사라진다 */
const STAMP_BURST = {
  delayMs: 120,
  durationMs: 480,
  startScale: 0.7,
  growScale: 0.85,
  peakOpacity: 0.55,
} as const;

/** 동작 줄이기면 찍힌 모습에서 시작해 움직이지 않는다 */
function getStampPressStartProgress(isReducedMotion: boolean): number {
  return isReducedMotion ? 1 : 0;
}

export interface StampPressProps {
  /** 처음 그릴 때 한 번 찍는다. 다시 찍으려면 쓰는 쪽이 key를 바꿔 새로 그린다. 도장 크기는 children이 정한다 */
  children: ReactNode;
  /** 여러 도장을 차례로 찍을 때 늦출 시간(ms) */
  delay?: number;
  /** 찍히는 모양. 기본은 쿵 찍히는 `stamp` */
  motion?: StampMotion;
  /** 퍼지는 테두리 모양. 기본은 main 색 둥근 테두리 */
  burstClassName?: string;
  className?: string;
}

/** 도장이 쿵 찍히고 테두리가 한 번 퍼진다. transform·opacity만 UI 스레드에서 바꾸고, 사라지면 멈춘다 */
export function StampPress({
  children,
  delay = 0,
  motion = 'stamp',
  burstClassName,
  className,
}: StampPressProps) {
  const { spring, scale, rotateDeg, rotateTravelDeg } = STAMP_MOTIONS[motion];
  const isReducedMotion = useIsReduceMotionEnabled();
  const press = useSharedValue(getStampPressStartProgress(isReducedMotion));
  const burst = useSharedValue(getStampPressStartProgress(isReducedMotion));

  useEffect(() => {
    if (isReducedMotion) {
      press.set(1);
      burst.set(1);
      return;
    }

    press.set(withDelay(delay, withSpring(1, { ...spring, reduceMotion: ReduceMotion.System })));
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
  }, [burst, delay, isReducedMotion, press, spring]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(press.get() * 2, 1),
    transform: [
      { scale: scale - press.get() * (scale - 1) },
      { rotate: `${rotateDeg + press.get() * rotateTravelDeg}deg` },
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
      <Animated.View style={stampStyle}>{children}</Animated.View>
    </Box>
  );
}
