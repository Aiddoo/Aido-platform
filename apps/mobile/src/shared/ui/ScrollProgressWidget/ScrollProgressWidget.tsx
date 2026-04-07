import { ArrowUpIcon } from '@src/shared/ui/Icon/icons';
import { PressableFeedback } from 'heroui-native';
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { ReText } from 'react-native-redash';
import { useResolveClassNames } from 'uniwind';

const WIDGET_SIZE = { collapsed: 56, expanded: 180 } as const;
const TIMING = { fast: 250, normal: 400 } as const;

interface ScrollProgressWidgetProps {
  progress: SharedValue<number>;
  onScrollToTop: () => void;
  bottomOffset?: number;
}

export const ScrollProgressWidget = memo(function ScrollProgressWidget({
  progress,
  onScrollToTop,
  bottomOffset = 50,
}: ScrollProgressWidgetProps) {
  const surface = useResolveClassNames('bg-gray-2');
  const inner = useResolveClassNames('bg-gray-3');
  const track = useResolveClassNames('bg-gray-4');
  const label = useResolveClassNames('text-gray-6');
  const brand = useResolveClassNames('text-main');
  const border = useResolveClassNames('border-gray-3');

  const isScrolling = useDerivedValue(() => progress.value > 0 && progress.value < 1);
  const isAtEnd = useDerivedValue(() => progress.value >= 1);
  const isVisible = useDerivedValue(() => progress.value > 0);

  const containerStyle = useAnimatedStyle(() => ({
    width: withTiming(isScrolling.value ? WIDGET_SIZE.expanded : WIDGET_SIZE.collapsed, {
      duration: TIMING.normal,
    }),
    opacity: withTiming(isVisible.value ? 1 : 0, { duration: TIMING.fast }),
    transform: [
      {
        translateY: withTiming(isVisible.value ? 0 : 20, { duration: TIMING.normal }),
      },
    ],
  }));

  const barOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(isScrolling.value ? 1 : 0, { duration: TIMING.fast }),
  }));

  const arrowOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(isAtEnd.value ? 1 : 0, { duration: TIMING.fast }),
  }));

  const fillWidth = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  const percentText = useDerivedValue(() => `${Math.round(progress.value * 100)}%`);

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: bottomOffset },
        containerStyle,
        {
          backgroundColor: surface.backgroundColor as string,
          borderColor: border.borderColor as string,
        },
      ]}
    >
      <Animated.View
        style={[styles.bar, barOpacity, { backgroundColor: inner.backgroundColor as string }]}
      >
        <ReText style={[styles.percent, { color: label.color as string }]} text={percentText} />
        <Animated.View style={[styles.track, { backgroundColor: track.backgroundColor as string }]}>
          <Animated.View
            style={[styles.fill, fillWidth, { backgroundColor: brand.color as string }]}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.collapsed,
          arrowOpacity,
          { backgroundColor: inner.backgroundColor as string },
        ]}
      >
        <PressableFeedback onPress={onScrollToTop} className="flex-1 items-center justify-center">
          <ArrowUpIcon width={20} height={20} colorClassName="text-gray-8" />
        </PressableFeedback>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    height: 56,
    borderRadius: 28,
    borderWidth: 0.5,
    zIndex: 100,
  },
  bar: {
    flex: 1,
    borderRadius: 24,
    margin: 4,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  percent: {
    fontSize: 13,
    width: 44,
    textAlign: 'center',
    fontWeight: '600',
  },
  track: {
    height: 3,
    width: '60%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 2,
  },
  collapsed: {
    borderRadius: 24,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
