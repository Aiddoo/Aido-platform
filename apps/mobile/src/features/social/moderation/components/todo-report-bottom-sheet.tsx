import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  useSheetRoute,
} from '@src/shared/ui';
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

/** 주인을 읽지 못하면 시트 안에 다시 시도·문의를 두고, 문의는 시트를 닫은 뒤 연다 */
TodoReportBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <Result
        title={t('errorBoundary.title')}
        button={
          <QueryErrorActions
            onRetry={reset}
            onInquiry={(href) => sheet.close({ type: 'dismiss-to', href })}
          />
        }
      />
    </BottomSheet>
  );
};
