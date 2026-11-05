import { LinearGradient } from 'expo-linear-gradient';
import { ScrollShadow } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useResolveClassNames } from 'uniwind';

/** 화면·시트 스크롤의 흐림 길이. 두 표면이 같은 값을 쓴다 */
export const SCROLL_FADE_HEIGHT = 32;

type ScreenScrollShadowProps = Omit<
  ComponentProps<typeof ScrollShadow>,
  'LinearGradientComponent' | 'color' | 'size'
>;

/** 화면 안 스크롤을 감싸 잘리는 쪽을 화면 배경색으로 흐리게 덮는다. 넘치지 않으면 보이지 않는다 */
export function ScreenScrollShadow(props: ScreenScrollShadowProps) {
  const { backgroundColor } = useResolveClassNames('bg-white');

  return (
    <ScrollShadow
      {...props}
      LinearGradientComponent={LinearGradient}
      color={typeof backgroundColor === 'string' ? backgroundColor : undefined}
      size={SCROLL_FADE_HEIGHT}
    />
  );
}
