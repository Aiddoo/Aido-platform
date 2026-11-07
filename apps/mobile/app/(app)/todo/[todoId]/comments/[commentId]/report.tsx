import { findCachedTodoComment } from '@src/features/engagement/comment/queries/todo-comment-cache';
import { ReportReasonBottomSheet } from '@src/features/social/moderation/components/report-reason-bottom-sheet';
import { UserReportPolicy } from '@src/features/social/moderation/domains/user-report.model';
import { commentReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { useTranslation } from '@src/shared/i18n';
import { SheetRouteScreen } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * 댓글 ⋯ 메뉴에서 열어 이미 불러온 댓글로 작성자를 정한다.
 * 캐시에 없으면(오래된 링크) 신고할 작성자를 알 수 없어 피드로 돌아간다.
 */
export default function CommentReportSheetRoute() {
  const { t } = useTranslation('moderation');
  const queryClient = useQueryClient();
  const params = commentReportParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  const { todoId, commentId } = params.data;
  const author = findCachedTodoComment({ queryClient, todoId, commentId })?.author;

  return (
    <SheetRouteScreen>
      {author == null ? (
        <Redirect href="/feed" />
      ) : (
        <ReportReasonBottomSheet
          target={UserReportPolicy.createCommentReportTarget({ commentId, authorId: author.id })}
          targetDisplayName={author.name ?? t('fallbackName')}
        />
      )}
    </SheetRouteScreen>
  );
}
