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
        {/* 할 일은 목록에서 이미 받은 캐시라 기다릴 일이 거의 없고, 시트가 열리기 전 빈 자리를 그리지 않는다 */}
        <Suspense fallback={null}>
          <TodoReportBottomSheet />
        </Suspense>
      </QueryErrorBoundary>
    </SheetRouteScreen>
  );
}
