import { ReportReasonBottomSheet } from '@src/features/moderation/components/report-reason-bottom-sheet';
import { UserReportPolicy } from '@src/features/moderation/domains/user-report.model';
import {
  todoScreenParamsSchema,
  useTodoScreenParams,
} from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SheetRouteScreen } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

export default function TodoReportSheetRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <QueryErrorBoundary>
        <Suspense fallback={null}>
          <TodoReportSheet />
        </Suspense>
      </QueryErrorBoundary>
    </SheetRouteScreen>
  );
}

/** 할 일 상세 캐시에서 주인을 읽어 신고 대상으로 넘긴다. 상세 화면에서 열어 보통 바로 그린다 */
function TodoReportSheet() {
  const { t } = useTranslation('moderation');
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return (
    <ReportReasonBottomSheet
      target={UserReportPolicy.todoTarget({ todoId, ownerId: detail.owner.id })}
      targetDisplayName={detail.owner.name ?? t('fallbackName')}
    />
  );
}
