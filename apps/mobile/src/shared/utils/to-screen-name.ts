function isRouteGroup(segment: string) {
  return segment.startsWith('(') && segment.endsWith(')');
}

/** 동적 세그먼트를 그대로 둬 초대 코드·사용자 id가 남지 않고 화면 수가 라우트 파일 수로 고정된다 */
export function toScreenName(segments: readonly string[]): string {
  const visible = segments.filter((segment) => !isRouteGroup(segment) && segment !== 'index');
  return `/${visible.join('/')}`;
}
