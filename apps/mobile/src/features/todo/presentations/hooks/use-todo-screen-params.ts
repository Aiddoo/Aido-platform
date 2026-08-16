import { todoDetailsParamSchema } from '@aido/validators';
import { useLocalSearchParams } from 'expo-router';

/**
 * 할 일 상세 화면의 라우트 파라미터.
 * 정렬처럼 댓글이 소유한 URL 상태는 todo-comment feature의 훅이 따로 읽는다.
 */
export function useTodoScreenParams() {
  return todoDetailsParamSchema.parse(useLocalSearchParams());
}
