import { deleteTodoCategoryResponseSchema } from '@aido/api';

/** 계약의 result는 선택 칸이지만 지금 서버는 삭제 결과를 항상 싣는다 */
export const deleteTodoCategoryEnvelopeSchema = deleteTodoCategoryResponseSchema.required({
  result: true,
});
