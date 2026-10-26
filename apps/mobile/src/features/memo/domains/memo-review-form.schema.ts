import { convertMemoToTodosSchema } from '@aido/api';
import { parsedMemoResultSchema } from '@src/features/ai/domains/ai.model';
import { z } from 'zod';

/** 변환 요청에서 서버가 검사하는 제목 규칙(비어 있지 않고 최대 길이 이하)을 그대로 쓴다 */
export const reviewedTodoTitleSchema = convertMemoToTodosSchema.shape.todos.element.shape.title;

/** AI가 나눈 할 일을 사용자가 고친 뒤 변환하기 전의 검토 폼 */
export const memoReviewFormSchema = z.object({
  todos: z.array(
    parsedMemoResultSchema.shape.todos.element.extend({ title: reviewedTodoTitleSchema }),
  ),
});

/** 기본값이 이미 파싱된 AI 결과라 폼 값은 항상 출력 형태(items 등 기본값이 채워진 상태)다 */
export type MemoReviewFormValues = z.output<typeof memoReviewFormSchema>;
