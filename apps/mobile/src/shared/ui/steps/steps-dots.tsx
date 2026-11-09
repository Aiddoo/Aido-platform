import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { range } from 'es-toolkit';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import { fadeTo, springTo } from './steps-motion';

const DOT_SIZE = 10;
const DOT_SPACING = 20;
const BAR_PADDING = 20;
const BAR_HEIGHT = DOT_SIZE + BAR_PADDING;

interface StepsDotsProps {
  index: number;
  count: number;
  /** 손가락을 따라 움직이는 장 위치(0부터, 소수). 주면 넘기는 동안 막대·점이 UI 스레드에서 바로 따라온다 */
  progress?: SharedValue<number>;
}

function getBarWidth(position: number) {
  'worklet';
  return (position + 1) * DOT_SIZE + position * DOT_SPACING + BAR_PADDING;
}

/** 워크릿에서 색을 섞으려면 문자열 색이 필요해서 토큰 클래스를 색 값으로 풀어 둔다 */
function useBackgroundColor(className: string): string {
  const { backgroundColor } = useResolveClassNames(className);
  return typeof backgroundColor === 'string' ? backgroundColor : 'transparent';
}

interface StepsDotProps {
  dotIndex: number;
  index: number;
  progress: SharedValue<number> | undefined;
  passedColor: string;
  upcomingColor: string;
  isReducedMotion: boolean;
}

function StepsDot({
  dotIndex,
  index,
  progress,
  passedColor,
  upcomingColor,
  isReducedMotion,
}: StepsDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    if (progress != null) {
      // 막대 끝이 이 점에 닿는 동안 색이 넘어간다
      const reach = Math.min(Math.max(progress.get() - dotIndex + 1, 0), 1);
      return { backgroundColor: interpolateColor(reach, [0, 1], [upcomingColor, passedColor]) };
    }
    const color = index >= dotIndex ? passedColor : upcomingColor;
    return { backgroundColor: fadeTo(color, isReducedMotion) };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

/** 점 뒤 막대가 현재 단계까지 늘어나고, 지난 점은 막대 위에서 밝아진다 */
export function StepsDots({ index, count, progress }: StepsDotsProps) {
  const isReducedMotion = useIsReduceMotionEnabled();
  const passedColor = useBackgroundColor('bg-white dark:bg-gray-9');
  const upcomingColor = useBackgroundColor('bg-gray-4');
  const barColor = useBackgroundColor('bg-main');

  const barStyle = useAnimatedStyle(() => {
    if (progress != null) {
      return { width: getBarWidth(Math.min(Math.max(progress.get(), 0), count - 1)) };
    }
    return { width: springTo(getBarWidth(index), isReducedMotion) };
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.row}
    >
      <Animated.View style={[styles.bar, { backgroundColor: barColor }, barStyle]} />
      {range(count).map((dotIndex) => (
        <StepsDot
          key={dotIndex}
          dotIndex={dotIndex}
          index={index}
          progress={progress}
          passedColor={passedColor}
          upcomingColor={upcomingColor}
          isReducedMotion={isReducedMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DOT_SPACING,
    height: BAR_HEIGHT,
    paddingHorizontal: BAR_PADDING / 2,
  },
  bar: {
    borderCurve: 'continuous',
    borderRadius: 100,
    height: BAR_HEIGHT,
    position: 'absolute',
  },
  dot: {
    borderCurve: 'continuous',
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
});
