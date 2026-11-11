import { ReportReasonBottomSheet } from '@src/features/social/moderation/components/report-reason-bottom-sheet';
import { createCommentReportTarget } from '@src/features/social/moderation/domains/user-report.model';
import { commentReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTranslation } from '@src/shared/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';

import { findCachedTodoComment } from '../queries/todo-comment-cache';

/**
 * 댓글 ⋯ 메뉴에서 열어 이미 불러온 댓글로 작성자를 정한다.
 * 캐시에 없으면(오래된 링크) 신고할 작성자를 알 수 없어 피드로 돌아간다.
 */
export function CommentReportBottomSheet() {
  const { t } = useTranslation('moderation');
  const queryClient = useQueryClient();
  const [{ todoId, commentId }] = useRouteParams(commentReportParamsSchema);
  const author = findCachedTodoComment(queryClient, { todoId, commentId })?.author;

  if (author == null) {
    return <Redirect href="/feed" />;
  }

  return (
    <ReportReasonBottomSheet
      target={createCommentReportTarget({ commentId, authorId: author.id })}
      targetDisplayName={author.name ?? t('fallbackName')}
    />
  );
}
