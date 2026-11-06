import { useResolveClassNames } from 'uniwind';

/** 워크릿에서 색을 섞으려면 문자열 색이 필요해서 토큰 클래스를 색 값으로 풀어 둔다 */
export function useStepsBackgroundColor(className: string): string {
  const { backgroundColor } = useResolveClassNames(className);
  return typeof backgroundColor === 'string' ? backgroundColor : 'transparent';
}
