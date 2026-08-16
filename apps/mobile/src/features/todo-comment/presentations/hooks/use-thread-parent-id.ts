import { useLocalSearchParams, useSegments } from 'expo-router';

/**
 * 이 화면이 어느 댓글의 답글을 보고 있는지.
 * 할 일 상세에는 부모가 없어 최상위 댓글을 보고, 스레드 화면은 그 댓글의 답글을 본다.
 * 라우트가 답을 갖고 있으므로 컴포넌트에 식별자를 내려보내지 않는다.
 */
export function useThreadParentId(): string | null {
  // 타입이 좁은 라우트 튜플이라, 이름 하나를 찾을 때는 문자열 목록으로 본다.
  const segments: readonly string[] = useSegments();
  const { commentId } = useLocalSearchParams<{ commentId?: string }>();

  // 경로 자체가 스레드일 때만 부모가 있다 — 쿼리로 흘러든 같은 이름의 값에 속지 않는다.
  return segments.includes('[commentId]') ? (commentId ?? null) : null;
}
