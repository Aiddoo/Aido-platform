import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTranslation } from '@src/shared/i18n';
import { useSuspenseQuery } from '@tanstack/react-query';

import { createTodoReportTarget } from '../domains/user-report.model';
import { ReportReasonBottomSheet } from './report-reason-bottom-sheet';

/** 할 일 상세 캐시에서 주인을 읽어 신고 대상으로 넘긴다. 상세 화면에서 열어 보통 바로 그린다 */
export function TodoReportBottomSheet() {
  const { t } = useTranslation('moderation');
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));

  return (
    <ReportReasonBottomSheet
      target={createTodoReportTarget({ todoId, ownerId: detail.owner.id })}
      targetDisplayName={detail.owner.name ?? t('fallbackName')}
    />
  );
}
