import { CommentReportBottomSheet } from '@src/features/engagement/comment/components/comment-report-bottom-sheet';
import { commentReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function CommentReportSheetRoute() {
  const route = useRouteParamsOrRedirect(commentReportParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <CommentReportBottomSheet />
    </SheetRouteScreen>
  );
}
