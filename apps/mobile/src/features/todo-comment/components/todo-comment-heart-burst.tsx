import { HeartFilledIcon } from '@src/shared/ui';
import { times } from 'es-toolkit/compat';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const BIG_HEART_SIZE = 72;
const RING_SIZE = 80;
const RING_BORDER_WIDTH = 3;
const DOT_SIZE = 14;
const DOT_COUNT = 8;
const DOT_ANGLE_STEP_DEG = 45;
const DOT_ANGLE_OFFSET_DEG = 22;
const DOT_FLIGHT_DISTANCE = 54;
const DOT_FADE_DISTANCE = 66;
const DOT_PEAK_PROGRESS = 0.6;

const BIG_HEART = {
  peakScale: 1.32,
  reboundScale: 0.9,
  fadeScale: 0.6,
  startRotateDeg: -14,
  overshootRotateDeg: 6,
  riseDistance: 26,
  appearMs: 120,
  rotateMs: 140,
  holdUntilMs: 740,
  fadeMs: 260,
  reducedHoldMs: 300,
  reducedFadeMs: 180,
} as const;
const RING = { startScale: 0.3, endScale: 1.7, startOpacity: 0.7, durationMs: 520 } as const;
const DOTS = { delayMs: 60, durationMs: 680 } as const;
const BUTTON_POP = { fromScale: 0.6, peakScale: 1.35 } as const;
const SPRING = { damping: 9, stiffness: 320, mass: 0.6 } as const;

const DOT_COLOR_CLASS_NAMES = ['text-error', 'text-main'] as const;

function getDotColorClassName(index: number) {
  return index % 2 === 0 ? DOT_COLOR_CLASS_NAMES[0] : DOT_COLOR_CLASS_NAMES[1];
}

export interface TodoCommentHeartBurstValues {
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  bigScale: SharedValue<number>;
  bigRotate: SharedValue<number>;
  bigOpacity: SharedValue<number>;
  bigRise: SharedValue<number>;
  ring: SharedValue<number>;
  dots: SharedValue<number>;
}

export function useTodoCommentHeartBurstValues(): TodoCommentHeartBurstValues {
  return {
    originX: useSharedValue(0),
    originY: useSharedValue(0),
    bigScale: useSharedValue(0),
    bigRotate: useSharedValue(0),
    bigOpacity: useSharedValue(0),
    bigRise: useSharedValue(0),
    ring: useSharedValue(1),
    dots: useSharedValue(1),
  };
}

/** UI 스레드에서만 움직인다. 동작 줄이기면 링·작은 하트 없이 큰 하트만 나타났다 사라진다 */
export function playTodoCommentHeartBurst(
  burst: TodoCommentHeartBurstValues,
  { x, y, isReducedMotion }: { x: number; y: number; isReducedMotion: boolean },
) {
  'worklet';
  burst.originX.value = x;
  burst.originY.value = y;
  burst.bigRise.value = 0;
  burst.bigRotate.value = 0;

  if (isReducedMotion) {
    burst.bigScale.value = 1;
    burst.ring.value = 1;
    burst.dots.value = 1;
    burst.bigOpacity.value = withSequence(
      withTiming(1, { duration: BIG_HEART.appearMs }),
      withDelay(BIG_HEART.reducedHoldMs, withTiming(0, { duration: BIG_HEART.reducedFadeMs })),
    );
    return;
  }

  const fade = { duration: BIG_HEART.fadeMs, easing: Easing.in(Easing.quad) };
  burst.bigScale.value = withSequence(
    withTiming(0, { duration: 0 }),
    withSpring(BIG_HEART.peakScale, SPRING),
    withSpring(BIG_HEART.reboundScale, SPRING),
    withSpring(1, SPRING),
    withDelay(
      BIG_HEART.holdUntilMs - BIG_HEART.appearMs * 3,
      withTiming(BIG_HEART.fadeScale, fade),
    ),
  );
  burst.bigRotate.value = withSequence(
    withTiming(BIG_HEART.startRotateDeg, { duration: 0 }),
    withTiming(BIG_HEART.overshootRotateDeg, { duration: BIG_HEART.rotateMs }),
    withSpring(0, SPRING),
  );
  burst.bigOpacity.value = withSequence(
    withTiming(1, { duration: BIG_HEART.appearMs }),
    withDelay(BIG_HEART.holdUntilMs - BIG_HEART.appearMs, withTiming(0, fade)),
  );
  burst.bigRise.value = withDelay(BIG_HEART.holdUntilMs, withTiming(-BIG_HEART.riseDistance, fade));
  burst.ring.value = withSequence(
    withTiming(0, { duration: 0 }),
    withTiming(1, { duration: RING.durationMs, easing: Easing.out(Easing.quad) }),
  );
  burst.dots.value = withSequence(
    withTiming(0, { duration: 0 }),
    withDelay(
      DOTS.delayMs,
      withTiming(1, { duration: DOTS.durationMs, easing: Easing.bezier(0.15, 0.8, 0.3, 1) }),
    ),
  );
}

/** 좋아요 버튼 하트가 0.6 → 1.35 → 1로 튄다 */
export function popTodoCommentLikeButton(scale: SharedValue<number>) {
  'worklet';
  scale.value = withSequence(
    withTiming(BUTTON_POP.fromScale, { duration: 0 }),
    withSpring(BUTTON_POP.peakScale, SPRING),
    withSpring(1, SPRING),
  );
}

export function TodoCommentHeartBurst({ burst }: { burst: TodoCommentHeartBurstValues }) {
  const originStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: burst.originX.value }, { translateY: burst.originY.value }],
  }));
  const bigStyle = useAnimatedStyle(() => ({
    opacity: burst.bigOpacity.value,
    transform: [
      { translateY: burst.bigRise.value },
      { scale: burst.bigScale.value },
      { rotate: `${burst.bigRotate.value}deg` },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.ring.value, [0, 1], [RING.startOpacity, 0]),
    transform: [{ scale: interpolate(burst.ring.value, [0, 1], [RING.startScale, RING.endScale]) }],
  }));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.origin, originStyle]}>
        <Animated.View style={[styles.ring, ringStyle]}>
          <View style={styles.ringStroke} className="border-error" />
        </Animated.View>
        {times(DOT_COUNT, (index) => (
          <BurstDot
            key={index}
            progress={burst.dots}
            angleDeg={index * DOT_ANGLE_STEP_DEG + DOT_ANGLE_OFFSET_DEG}
            colorClassName={getDotColorClassName(index)}
          />
        ))}
        <Animated.View style={[styles.bigHeart, bigStyle]}>
          <HeartFilledIcon
            width={BIG_HEART_SIZE}
            height={BIG_HEART_SIZE}
            colorClassName="text-error"
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function BurstDot({
  progress,
  angleDeg,
  colorClassName,
}: {
  progress: SharedValue<number>;
  angleDeg: number;
  colorClassName: (typeof DOT_COLOR_CLASS_NAMES)[number];
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, DOT_PEAK_PROGRESS, 1], [1, 1, 0]),
    transform: [
      { rotate: `${angleDeg}deg` },
      {
        translateY: interpolate(
          progress.value,
          [0, DOT_PEAK_PROGRESS, 1],
          [0, -DOT_FLIGHT_DISTANCE, -DOT_FADE_DISTANCE],
        ),
      },
      { scale: interpolate(progress.value, [0, DOT_PEAK_PROGRESS, 1], [0.4, 1, 0.2]) },
    ],
  }));

  return (
    <Animated.View style={[styles.dot, style]}>
      <HeartFilledIcon width={DOT_SIZE} height={DOT_SIZE} colorClassName={colorClassName} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', top: 0, left: 0, width: 0, height: 0 },
  bigHeart: {
    position: 'absolute',
    width: BIG_HEART_SIZE,
    height: BIG_HEART_SIZE,
    left: -BIG_HEART_SIZE / 2,
    top: -BIG_HEART_SIZE / 2,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    left: -RING_SIZE / 2,
    top: -RING_SIZE / 2,
  },
  ringStroke: { flex: 1, borderRadius: RING_SIZE / 2, borderWidth: RING_BORDER_WIDTH },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    left: -DOT_SIZE / 2,
    top: -DOT_SIZE / 2,
  },
});
