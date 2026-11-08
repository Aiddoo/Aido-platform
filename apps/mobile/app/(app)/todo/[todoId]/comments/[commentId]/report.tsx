import { CommentReportBottomSheet } from '@src/features/engagement/comment/components/comment-report-bottom-sheet';
import { commentReportParamsSchema } from '@src/features/social/moderation/schemas/moderation-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CommentReportSheetRoute() {
  const params = commentReportParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <CommentReportBottomSheet />
    </SheetRouteScreen>
  );
}
