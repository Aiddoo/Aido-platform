import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { fadeTo, springTo } from './steps-motion';
import { useStepsBackgroundColor } from './use-steps-color';

const DOT_SIZE = 10;
const DOT_SPACING = 20;
const BAR_PADDING = 20;

interface StepsDotsProps {
  index: number;
  count: number;
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
  const isReduced = useReduceMotion();
  const passedColor = useStepsBackgroundColor('bg-white');
  const upcomingColor = useStepsBackgroundColor('bg-gray-4');
  const barColor = useStepsBackgroundColor('bg-main');

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
      {Array.from({ length: count }, (_, dotIndex) => (
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
    paddingHorizontal: BAR_PADDING / 2,
  },
  bar: {
    borderCurve: 'continuous',
    borderRadius: 100,
    height: DOT_SIZE + 20,
    position: 'absolute',
  },
  dot: {
    borderCurve: 'continuous',
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
});
