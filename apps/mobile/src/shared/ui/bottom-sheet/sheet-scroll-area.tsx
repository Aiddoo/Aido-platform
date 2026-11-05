import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useResolveClassNames } from 'uniwind';

const FADE_HEIGHT = 32;

type SheetScrollShadowProps = Omit<
  ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'color' | 'size'
>;

/** 시트 안 스크롤을 감싸 잘리는 쪽을 시트 면 색으로 흐리게 덮는다. 넘치지 않으면 보이지 않는다 */
export function SheetScrollShadow(props: SheetScrollShadowProps) {
  const { backgroundColor } = useResolveClassNames('bg-white dark:bg-gray-1');

  return (
    <ScrollShadow
      {...props}
      LinearGradientComponent={LinearGradient}
      color={typeof backgroundColor === 'string' ? backgroundColor : undefined}
      size={FADE_HEIGHT}
    />
  );
}

interface SheetScrollAreaProps extends Pick<
  ComponentProps<typeof ScrollView>,
  'contentContainerStyle'
> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** 시트 내용의 세로 스크롤. 넘칠 때만 스크롤 막대와 흐림이 나타나 더 있다는 걸 알린다 */
export function SheetScrollArea({ style, contentContainerStyle, children }: SheetScrollAreaProps) {
  return (
    <SheetScrollShadow style={[styles.area, style]}>
      <ScrollView
        testID="sheet-scroll-area"
        style={styles.scroll}
        contentContainerStyle={contentContainerStyle}
        persistentScrollbar
        bounces={false}
      >
        {children}
      </ScrollView>
    </SheetScrollShadow>
  );
}

const styles = StyleSheet.create({
  area: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
