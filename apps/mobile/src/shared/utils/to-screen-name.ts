function isRouteGroup(segment: string) {
  return segment.startsWith('(') && segment.endsWith(')');
}

/**
 * Expo Router 파일 세그먼트로 분석용 화면 이름(라우트 템플릿)을 만든다.
 * 실제 경로 대신 `/invite/[inviteCode]`처럼 동적 세그먼트를 그대로 두어 초대 코드·사용자 id가 남지 않고
 * 화면 수가 라우트 파일 수로 고정된다. 그룹(`(app)`)과 `index`는 URL에 없으므로 뺀다.
 */
export function toScreenName(segments: readonly string[]): string {
  const visible = segments.filter((segment) => !isRouteGroup(segment) && segment !== 'index');
  return `/${visible.join('/')}`;
}
