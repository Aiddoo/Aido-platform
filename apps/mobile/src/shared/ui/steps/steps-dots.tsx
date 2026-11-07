import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { range } from 'es-toolkit';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import { fadeTo, springTo } from './steps-motion';

const DOT_SIZE = 10;
const DOT_SPACING = 20;
const BAR_PADDING = 20;
const BAR_HEIGHT = DOT_SIZE + BAR_PADDING;

interface StepsDotsProps {
  index: number;
  count: number;
}

/** 워크릿에서 색을 섞으려면 문자열 색이 필요해서 토큰 클래스를 색 값으로 풀어 둔다 */
function useBackgroundColor(className: string): string {
  const { backgroundColor } = useResolveClassNames(className);
  return typeof backgroundColor === 'string' ? backgroundColor : 'transparent';
}

interface StepsDotProps {
  dotIndex: number;
  index: number;
  passedColor: string;
  upcomingColor: string;
  isReduced: boolean;
}

function StepsDot({ dotIndex, index, passedColor, upcomingColor, isReduced }: StepsDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const color = index >= dotIndex ? passedColor : upcomingColor;
    return { backgroundColor: fadeTo(color, isReduced) };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

/** 점 뒤 막대가 현재 단계까지 늘어나고, 지난 점은 막대 위에서 밝아진다 */
export function StepsDots({ index, count }: StepsDotsProps) {
  const isReduced = useIsReduceMotionEnabled();
  const passedColor = useBackgroundColor('bg-white dark:bg-gray-9');
  const upcomingColor = useBackgroundColor('bg-gray-4');
  const barColor = useBackgroundColor('bg-main');

  const barStyle = useAnimatedStyle(() => ({
    width: springTo((index + 1) * DOT_SIZE + index * DOT_SPACING + BAR_PADDING, isReduced),
  }));

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
          passedColor={passedColor}
          upcomingColor={upcomingColor}
          isReduced={isReduced}
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
