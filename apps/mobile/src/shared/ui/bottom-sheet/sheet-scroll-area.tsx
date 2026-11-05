import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

import { Box } from '../box';

const FADE_HEIGHT = 32;
const FADE_GRADIENT_ID = 'sheet-scroll-fade';

export interface SheetScrollMetrics {
  viewportHeight: number;
  contentHeight: number;
  offsetY: number;
}

/** 스크롤 영역 아래에 아직 안 보인 내용이 남았는지. 소수점 오차로 끝에서 깜빡이지 않게 1은 봐준다 */
export function hasContentBelow({ viewportHeight, contentHeight, offsetY }: SheetScrollMetrics) {
  return viewportHeight > 0 && contentHeight - viewportHeight - offsetY > 1;
}

function SheetScrollFade() {
  const { backgroundColor } = useResolveClassNames('bg-white dark:bg-gray-1');
  const color = typeof backgroundColor === 'string' ? backgroundColor : undefined;

  return (
    <Box
      pointerEvents="none"
      testID="sheet-scroll-fade"
      className="absolute inset-x-0 bottom-0"
      style={{ height: FADE_HEIGHT }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={FADE_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${FADE_GRADIENT_ID})`} />
      </Svg>
    </Box>
  );
}

interface SheetScrollAreaProps extends Pick<
  ComponentProps<typeof ScrollView>,
  'contentContainerStyle'
> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * 시트 내용의 세로 스크롤. 내용이 넘칠 때만 스크롤 막대와 아래쪽 흐림이 나타나 더 있다는 걸 알린다.
 * 넘치지 않으면 아무것도 더해지지 않아 평소 모양이 그대로다.
 */
export function SheetScrollArea({ style, contentContainerStyle, children }: SheetScrollAreaProps) {
  const metricsRef = useRef<SheetScrollMetrics>({
    viewportHeight: 0,
    contentHeight: 0,
    offsetY: 0,
  });
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isContentBelow, setIsContentBelow] = useState(false);

  const updateMetrics = (next: Partial<SheetScrollMetrics>) => {
    metricsRef.current = { ...metricsRef.current, ...next };
    setIsOverflowing(metricsRef.current.contentHeight - metricsRef.current.viewportHeight > 1);
    setIsContentBelow(hasContentBelow(metricsRef.current));
  };

  return (
    <Box style={[styles.area, style]}>
      <ScrollView
        testID="sheet-scroll-area"
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={isOverflowing}
        persistentScrollbar={isOverflowing}
        bounces={false}
        scrollEventThrottle={16}
        onLayout={(event) => updateMetrics({ viewportHeight: event.nativeEvent.layout.height })}
        onContentSizeChange={(_width, height) => updateMetrics({ contentHeight: height })}
        onScroll={(event) => updateMetrics({ offsetY: event.nativeEvent.contentOffset.y })}
      >
        {children}
      </ScrollView>
      {isContentBelow && <SheetScrollFade />}
    </Box>
  );
}

const styles = StyleSheet.create({
  area: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
