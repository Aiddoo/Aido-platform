const GROUP_SEGMENT = /^\(.+\)$/;

/** 경로 조각이 URL에 들어가지 않는 Expo Router 그룹(`(tabs)`·`(me,memos,todos)`)인지 */
export function isRouteGroupSegment(segment: string): boolean {
  return GROUP_SEGMENT.test(segment);
}
