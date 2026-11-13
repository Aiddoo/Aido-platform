import { ANIMATION } from '@src/shared/constants/animation';
import {
  ReduceMotion,
  type WithSpringConfig,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const STEPS_SPRING_CONFIG = { duration: 250, dampingRatio: 1.5 } as const;

const STEPS_COLOR_DURATION_MS = ANIMATION.durationMs.normal;

/** 움직임 줄이기가 켜져 있으면 목표 값으로 바로 간다. 애니메이션마다 부르는 worklet이라 위치 인자를 유지한다 */
export function springTo(value: number, isReducedMotion: boolean, config?: WithSpringConfig) {
  'worklet';
  return withSpring(value, {
    ...config,
    reduceMotion: isReducedMotion ? ReduceMotion.Always : ReduceMotion.Never,
  });
}

export function fadeTo(color: string, isReducedMotion: boolean) {
  'worklet';
  return withTiming(color, {
    duration: STEPS_COLOR_DURATION_MS,
    reduceMotion: isReducedMotion ? ReduceMotion.Always : ReduceMotion.Never,
  });
}
