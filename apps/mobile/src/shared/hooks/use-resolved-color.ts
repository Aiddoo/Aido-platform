import { useResolveClassNames } from 'uniwind';

/** 읽지 못하면 투명이다 */
export function useResolvedColor(className: `text-${string}`): string {
  const { color } = useResolveClassNames(className);

  return typeof color === 'string' ? color : 'transparent';
}
