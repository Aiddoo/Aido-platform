import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  type WithTimingConfig,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface UseBlinkAnimationConfig {
  /** 시작 값 (기본: 1) */
  from?: number;
  /** 목표 값 (기본: 0.3) */
  to?: number;
  /** 애니메이션 config - reanimated withTiming과 동일 */
  timing?: WithTimingConfig;
  /** 비활성화 시 복귀 애니메이션 config */
  resetTiming?: WithTimingConfig;
}

const DEFAULT_CONFIG = {
  from: 1,
  to: 0.3,
  timing: { duration: 600 },
  resetTiming: { duration: 200 },
} satisfies Required<UseBlinkAnimationConfig>;

/**
 * 활성/비활성 상태에 따라 깜빡이는 애니메이션 스타일 반환
 *
 * @example
 * const animatedStyle = useBlinkAnimation(isRecording);
 *
 * @example
 * const animatedStyle = useBlinkAnimation(isRecording, {
 *   to: 0.5,
 *   timing: { duration: 800 },
 * });
 *
 * return <Animated.View style={animatedStyle}>...</Animated.View>;
 */
export function useBlinkAnimation(isActive: boolean, config?: UseBlinkAnimationConfig) {
  const { from, to, timing, resetTiming } = { ...DEFAULT_CONFIG, ...config };
  const opacity = useSharedValue(from);

  useEffect(() => {
    if (isActive) {
      opacity.value = withRepeat(withTiming(to, timing), -1, true);
    } else {
      opacity.value = withTiming(from, resetTiming);
    }
  }, [isActive, from, to, timing, resetTiming, opacity]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
}
