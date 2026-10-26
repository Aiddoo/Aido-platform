import { ReportReasonBottomSheet } from '@src/features/moderation/components/report-reason-bottom-sheet';
import { UserReportPolicy } from '@src/features/moderation/domains/user-report.model';
import {
  commentReportRouteParamsSchema,
  useCommentReportRouteParams,
} from '@src/features/moderation/hooks/use-comment-report-route-params';
import { findCachedTodoComment } from '@src/features/todo-comment/queries/todo-comment-cache';
import { TODO_SHEET_FALLBACK_HREF } from '@src/features/todo/utils/navigation/todo-sheet-href';
import { useTranslation } from '@src/shared/i18n';
import { SheetRouteScreen } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CommentReportSheetRoute() {
  const params = commentReportRouteParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <CommentReportSheet />
    </SheetRouteScreen>
  );
}

/**
 * 댓글 ⋯ 메뉴에서 열어 이미 불러온 댓글로 작성자를 정한다.
 * 캐시에 없으면(오래된 링크) 신고할 작성자를 알 수 없어 피드로 돌아간다.
 */
function CommentReportSheet() {
  const { t } = useTranslation('moderation');
  const queryClient = useQueryClient();
  const { todoId, commentId } = useCommentReportRouteParams();
  const author = findCachedTodoComment({ queryClient, todoId, commentId })?.author;

  if (author == null) {
    return <Redirect href={TODO_SHEET_FALLBACK_HREF} />;
  }

  return (
    <ReportReasonBottomSheet
      target={UserReportPolicy.commentTarget({ commentId, authorId: author.id })}
      targetDisplayName={author.name ?? t('fallbackName')}
    />
  );
}
