import { todoScreenParamsSchema } from '@src/features/todo/hooks/use-todo-screen-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const commentReportRouteParamsSchema = todoScreenParamsSchema.extend({
  commentId: z.cuid(),
});

export function useCommentReportRouteParams() {
  return commentReportRouteParamsSchema.parse(useLocalSearchParams());
}
