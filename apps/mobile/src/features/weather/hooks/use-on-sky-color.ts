import { useResolveClassNames } from 'uniwind';

/** SVG처럼 className을 받지 않는 곳에 on-sky 토큰 색(투명도 포함)을 값으로 넘긴다. */
export function useOnSkyColor(className: `text-on-sky${string}`): string | undefined {
  const { color } = useResolveClassNames(className);
  return typeof color === 'string' ? color : undefined;
}
