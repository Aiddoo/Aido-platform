import { useResolveClassNames } from 'uniwind';

/** Skia·SVG처럼 className을 받지 않는 곳에 테마 토큰 색(`text-main`, `text-on-sky/32` 등)을 문자열로 넘긴다. 읽지 못하면 투명이다 */
export function useResolvedColor(className: `text-${string}`): string {
  const { color } = useResolveClassNames(className);

  return typeof color === 'string' ? color : 'transparent';
}
