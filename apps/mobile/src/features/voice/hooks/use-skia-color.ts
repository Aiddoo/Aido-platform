import { useResolveClassNames } from 'uniwind';

/** Skia는 className을 모르므로 테마 토큰(`text-main` 등)을 현재 테마의 색 문자열로 읽는다 */
export function useSkiaColor(className: string): string {
  const { color } = useResolveClassNames(className);

  return typeof color === 'string' ? color : 'transparent';
}
