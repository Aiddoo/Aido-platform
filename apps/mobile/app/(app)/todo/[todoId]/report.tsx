import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { TodoReportBottomSheet } from '@src/features/social/moderation/components/todo-report-bottom-sheet';
import { QueryErrorBoundary, SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

export default function TodoReportSheetRoute() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <QueryErrorBoundary>
        <Suspense fallback={null}>
          <TodoReportBottomSheet />
        </Suspense>
      </QueryErrorBoundary>
    </SheetRouteScreen>
  );
}
