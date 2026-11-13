import {
  Canvas,
  Group,
  matchFont,
  RoundedRect,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import { ArrowUpIcon, IconButton, StyledSafeAreaView } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  clamp,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  getPercentIndex,
  getProgressRowStart,
  getScrollProgressState,
  getTrackWidth,
  type ScrollProgressState,
  shouldReportPercent,
} from '../utils/scroll-progress.geometry';

const WIDGET_SIZE = { collapsed: 56, expanded: 180 } as const;
const PILL_RADIUS = WIDGET_SIZE.collapsed / 2;
const BAR_INSET = 4;
const BAR_RADIUS = PILL_RADIUS - BAR_INSET;
const BORDER_WIDTH = 0.5;
const PERCENT_SLOT_WIDTH = 44;
const PERCENT_FONT_SIZE = 13;
const TRACK = { height: 3, radius: 2 } as const;
const HIDDEN_OFFSET_Y = 20;
const ARROW_SIZE = WIDGET_SIZE.collapsed - BAR_INSET * 2;
const ARROW_ICON_SIZE = 20;
const PERCENT_LABELS = range(101).map((percent) => `${percent}%`);
/** 원래 위젯의 시간이다(폭·위치 400ms, 나타남 250ms, Reanimated 기본 곡선). ANIMATION에 같은 값이 없다 */
const RESIZE_TIMING = { duration: 400 };
const FADE_TIMING = { duration: 250 };

interface ScrollProgressWidgetProps {
  progress: SharedValue<number>;
  onScrollToTop: () => void;
  bottomOffset: number;
}

/**
 * 메모 목록을 내리는 동안 얼마나 내렸는지 보여 주고, 끝에 닿으면 맨 위로 버튼이 된다.
 * 면·막대·퍼센트는 Skia 하나에 그려 폭이 바뀌어도 RN 배치를 다시 하지 않는다. 움직이는 RN View는 opacity·transform만 바꾼다.
 * 동작은 enzomanuelmangano/demos를 참고해 다시 구현했다. 그 저장소 LICENSE는 코드 재배포를 금지해 코드를 옮기지 않았다
 */
export const ScrollProgressWidget = memo(function ScrollProgressWidget({
  progress,
  onScrollToTop,
  bottomOffset,
}: ScrollProgressWidgetProps) {
  const { t } = useTranslation('memo');
  const fontScaledSize = useFontScaledSize();
  const isAnimationActive = useIsAnimationActive();
  const surfaceColor = useResolvedColor('text-gray-2');
  // 막대와 테두리는 같은 회색이다
  const barColor = useResolvedColor('text-gray-3');
  const trackColor = useResolvedColor('text-gray-4');
  const labelColor = useResolvedColor('text-gray-6');
  const fillColor = useResolvedColor('text-main');

  // 스크린 리더 값과 상태는 상태가 바뀌거나 5%씩 움직일 때만 JS로 넘긴다
  const [accessibleState, setAccessibleState] = useState<ScrollProgressState>('hidden');
  const [accessiblePercent, setAccessiblePercent] = useState(0);

  const percentFontSize = fontScaledSize(PERCENT_FONT_SIZE);
  // 글꼴과 글자 폭은 글자 크기가 바뀔 때만 만든다. 프레임마다는 표에서 고른다
  const percentFont = useMemo(
    () => matchFont({ fontSize: percentFontSize, fontWeight: '600' }),
    [percentFontSize],
  );
  // Skia 글꼴은 네이티브 객체라 글자 크기가 바뀌거나 화면이 내려가면 직접 놓는다
  useEffect(() => () => percentFont.dispose(), [percentFont]);
  const percentWidths = useMemo(
    () => PERCENT_LABELS.map((label) => percentFont.measureText(label).width),
    [percentFont],
  );
  const percentBaseline = useMemo(() => {
    const { ascent, descent } = percentFont.getMetrics();
    return WIDGET_SIZE.collapsed / 2 - (ascent + descent) / 2;
  }, [percentFont]);

  const pillWidth = useSharedValue<number>(WIDGET_SIZE.collapsed);
  const visibleOpacity = useSharedValue(0);
  const hiddenOffset = useSharedValue<number>(HIDDEN_OFFSET_Y);
  const barOpacity = useSharedValue(0);
  const arrowOpacity = useSharedValue(0);
  const reportedPercent = useSharedValue(0);

  // 상태가 바뀔 때만 목표로 움직인다. 화면 밖·앱 뒤·모션 줄이기에서는 움직이지 않고 바로 간다
  useAnimatedReaction(
    () => getScrollProgressState(progress.get()),
    (state: ScrollProgressState, previous: ScrollProgressState | null) => {
      if (state === previous) {
        return;
      }
      scheduleOnRN(setAccessibleState, state);
      const targets = {
        pillWidth: state === 'scrolling' ? WIDGET_SIZE.expanded : WIDGET_SIZE.collapsed,
        visibleOpacity: state === 'hidden' ? 0 : 1,
        hiddenOffset: state === 'hidden' ? HIDDEN_OFFSET_Y : 0,
        barOpacity: state === 'scrolling' ? 1 : 0,
        arrowOpacity: state === 'end' ? 1 : 0,
      };
      if (!isAnimationActive) {
        pillWidth.set(targets.pillWidth);
        visibleOpacity.set(targets.visibleOpacity);
        hiddenOffset.set(targets.hiddenOffset);
        barOpacity.set(targets.barOpacity);
        arrowOpacity.set(targets.arrowOpacity);
        return;
      }
      pillWidth.set(withTiming(targets.pillWidth, RESIZE_TIMING));
      visibleOpacity.set(withTiming(targets.visibleOpacity, FADE_TIMING));
      hiddenOffset.set(withTiming(targets.hiddenOffset, RESIZE_TIMING));
      barOpacity.set(withTiming(targets.barOpacity, FADE_TIMING));
      arrowOpacity.set(withTiming(targets.arrowOpacity, FADE_TIMING));
    },
    [isAnimationActive],
  );

  useAnimatedReaction(
    () => getPercentIndex(progress.get()),
    (percent: number) => {
      if (!shouldReportPercent(percent, reportedPercent.get())) {
        return;
      }
      reportedPercent.set(percent);
      scheduleOnRN(setAccessiblePercent, percent);
    },
  );

  const pillX = useDerivedValue(() => (WIDGET_SIZE.expanded - pillWidth.get()) / 2);
  const barX = useDerivedValue(() => pillX.get() + BAR_INSET);
  const barWidth = useDerivedValue(() => pillWidth.get() - BAR_INSET * 2);
  const trackWidth = useDerivedValue(() => getTrackWidth(pillWidth.get()));
  const rowStart = useDerivedValue(() =>
    getProgressRowStart(pillWidth.get(), WIDGET_SIZE.expanded, PERCENT_SLOT_WIDTH),
  );
  const trackX = useDerivedValue(() => rowStart.get() + PERCENT_SLOT_WIDTH);
  const fillWidth = useDerivedValue(() => trackWidth.get() * clamp(progress.get(), 0, 1));
  const percentIndex = useDerivedValue(() => getPercentIndex(progress.get()));
  const percentText = useDerivedValue(() => PERCENT_LABELS[percentIndex.get()] ?? '');
  const percentX = useDerivedValue(
    () => rowStart.get() + (PERCENT_SLOT_WIDTH - (percentWidths[percentIndex.get()] ?? 0)) / 2,
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visibleOpacity.get(),
    transform: [{ translateY: hiddenOffset.get() }],
  }));
  // 투명한 동안에도 Android는 터치를 받아 아래 메모 카드의 탭을 가로챈다. 보이는 면만큼만 터치를 받는다
  const pillTouchStyle = useAnimatedStyle(() => ({
    pointerEvents: visibleOpacity.get() > 0 ? 'auto' : 'none',
    transform: [{ scaleX: pillWidth.get() / WIDGET_SIZE.expanded }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.get(),
    // 끝이 아닌 동안 투명한 화살표가 터치를 받아 맨 위로 튀지 않게 한다
    pointerEvents: arrowOpacity.get() > 0 ? 'auto' : 'none',
  }));

  return (
    <StyledSafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.anchor, { bottom: bottomOffset }]}
    >
      <Animated.View style={[styles.widget, containerStyle]}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <RoundedRect
            x={pillX}
            y={0}
            width={pillWidth}
            height={WIDGET_SIZE.collapsed}
            r={PILL_RADIUS}
            color={surfaceColor}
          />
          <RoundedRect
            x={pillX}
            y={BORDER_WIDTH / 2}
            width={pillWidth}
            height={WIDGET_SIZE.collapsed - BORDER_WIDTH}
            r={PILL_RADIUS}
            color={barColor}
            style="stroke"
            strokeWidth={BORDER_WIDTH}
          />
          <Group opacity={barOpacity}>
            <RoundedRect
              x={barX}
              y={BAR_INSET}
              width={barWidth}
              height={WIDGET_SIZE.collapsed - BAR_INSET * 2}
              r={BAR_RADIUS}
              color={barColor}
            />
            <SkiaText
              x={percentX}
              y={percentBaseline}
              text={percentText}
              font={percentFont}
              color={labelColor}
            />
            <RoundedRect
              x={trackX}
              y={(WIDGET_SIZE.collapsed - TRACK.height) / 2}
              width={trackWidth}
              height={TRACK.height}
              r={TRACK.radius}
              color={trackColor}
            />
            <RoundedRect
              x={trackX}
              y={(WIDGET_SIZE.collapsed - TRACK.height) / 2}
              width={fillWidth}
              height={TRACK.height}
              r={TRACK.radius}
              color={fillColor}
            />
          </Group>
        </Canvas>

        <Animated.View style={[StyleSheet.absoluteFill, pillTouchStyle]}>
          {/* 원래 퍼센트 글자(ReText)를 VoiceOver·TalkBack이 읽던 것을 진행 막대 값으로 알린다 */}
          <View
            style={StyleSheet.absoluteFill}
            accessible={accessibleState === 'scrolling'}
            accessibilityElementsHidden={accessibleState !== 'scrolling'}
            importantForAccessibility={
              accessibleState === 'scrolling' ? 'yes' : 'no-hide-descendants'
            }
            accessibilityRole="progressbar"
            accessibilityLabel={t('list.scrollProgress')}
            accessibilityValue={{ min: 0, max: 100, now: accessiblePercent }}
          />
        </Animated.View>

        <Animated.View
          style={[styles.arrow, arrowStyle, { backgroundColor: barColor }]}
          accessibilityElementsHidden={accessibleState !== 'end'}
          importantForAccessibility={accessibleState === 'end' ? 'auto' : 'no-hide-descendants'}
        >
          <IconButton
            accessibilityLabel={t('list.scrollToTop')}
            icon={
              <ArrowUpIcon
                width={ARROW_ICON_SIZE}
                height={ARROW_ICON_SIZE}
                colorClassName="text-gray-8"
              />
            }
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
  widget: {
    width: WIDGET_SIZE.expanded,
    height: WIDGET_SIZE.collapsed,
    pointerEvents: 'box-none',
  },
  arrow: {
    position: 'absolute',
    top: BAR_INSET,
    left: (WIDGET_SIZE.expanded - ARROW_SIZE) / 2,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    borderRadius: ARROW_SIZE / 2,
    overflow: 'hidden',
  },
});
