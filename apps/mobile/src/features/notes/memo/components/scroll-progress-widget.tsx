import { useTranslation } from '@src/shared/i18n';
import { ArrowUpIcon, StyledSafeAreaView, IconButton } from '@src/shared/ui';
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
  bottomOffset: number;
}

export const ScrollProgressWidget = memo(function ScrollProgressWidget({
  progress,
  onScrollToTop,
  bottomOffset,
}: ScrollProgressWidgetProps) {
  const { t } = useTranslation('memo');
  const surface = useResolveClassNames('bg-gray-2');
  const inner = useResolveClassNames('bg-gray-3');
  const track = useResolveClassNames('bg-gray-4');
  const label = useResolveClassNames('text-gray-6');
  const brand = useResolveClassNames('text-main');
  const border = useResolveClassNames('border-gray-3');

  // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
  const isScrolling = useDerivedValue(() => 0 < progress.value && progress.value < 1);
  // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
  const isAtEnd = useDerivedValue(() => progress.value >= 1);
  // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
  const isVisible = useDerivedValue(() => progress.value > 0);

  const containerStyle = useAnimatedStyle(() => ({
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    width: withTiming(isScrolling.value ? WIDGET_SIZE.expanded : WIDGET_SIZE.collapsed, {
      duration: TIMING.normal,
    }),
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    opacity: withTiming(isVisible.value ? 1 : 0, { duration: TIMING.fast }),
    // 투명한 동안에도 Android는 터치를 받아 아래 메모 카드의 탭을 가로챈다
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    pointerEvents: isVisible.value ? 'auto' : 'none',
    transform: [
      {
        // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
        translateY: withTiming(isVisible.value ? 0 : 20, { duration: TIMING.normal }),
      },
    ],
  }));

  const barOpacity = useAnimatedStyle(() => ({
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    opacity: withTiming(isScrolling.value ? 1 : 0, { duration: TIMING.fast }),
  }));

  const arrowOpacity = useAnimatedStyle(() => ({
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    opacity: withTiming(isAtEnd.value ? 1 : 0, { duration: TIMING.fast }),
    // 끝이 아닌 동안 투명한 화살표가 진행 막대의 터치를 받아 맨 위로 튀지 않게 한다
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    pointerEvents: isAtEnd.value ? 'auto' : 'none',
  }));

  const fillWidth = useAnimatedStyle(() => ({
    // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
    width: `${interpolate(progress.value, [0, 1], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
  const percentText = useDerivedValue(() => `${Math.round(progress.value * 100)}%`);

  return (
    <StyledSafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.anchor, { bottom: bottomOffset }]}
    >
      <Animated.View
        style={[
          styles.container,
          containerStyle,
          {
            backgroundColor: surface.backgroundColor,
            borderColor: border.borderColor,
          },
        ]}
      >
        <Animated.View style={[styles.bar, barOpacity, { backgroundColor: inner.backgroundColor }]}>
          <ReText style={[styles.percent, { color: label.color }]} text={percentText} />
          <Animated.View style={[styles.track, { backgroundColor: track.backgroundColor }]}>
            <Animated.View style={[styles.fill, fillWidth, { backgroundColor: brand.color }]} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.collapsed,
            arrowOpacity,
            { backgroundColor: inner.backgroundColor },
          ]}
        >
          <IconButton
            accessibilityLabel={t('list.scrollToTop')}
            icon={<ArrowUpIcon width={20} height={20} colorClassName="text-gray-8" />}
            className="min-h-0 min-w-0 flex-1"
            onPress={onScrollToTop}
          />
        </Animated.View>
      </Animated.View>
    </StyledSafeAreaView>
  );
});

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 100,
  },
  container: {
    height: WIDGET_SIZE.collapsed,
    borderRadius: 28,
    borderWidth: 0.5,
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
