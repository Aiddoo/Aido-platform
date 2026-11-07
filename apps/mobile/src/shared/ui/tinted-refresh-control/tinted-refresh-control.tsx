import type { ComponentProps } from 'react';
import { RefreshControl } from 'react-native';
import { useResolveClassNames } from 'uniwind';

/** 앱 메인 색을 입힌 당겨서 새로고침. 원본 RefreshControl과 쓰는 법이 같다 */
export function TintedRefreshControl(props: ComponentProps<typeof RefreshControl>) {
  const { color } = useResolveClassNames('text-main');

  return (
    <RefreshControl tintColor={color} colors={color == null ? undefined : [color]} {...props} />
  );
}
