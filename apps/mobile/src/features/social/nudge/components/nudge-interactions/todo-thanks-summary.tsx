import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { INQUIRY_SHEET_EXIT, QueryErrorBoundary, type SheetRouteExit } from '@src/shared/ui';
import { Suspense } from 'react';

import { NudgeInteractionPolicy } from '../../domains/nudge-interaction.model';
import { ThanksSummaryRow } from './thanks-summary-row';

interface TodoThanksSummaryProps {
  todo: Pick<Todo, 'id' | 'completed' | 'visibility'>;
  onClose: (next?: SheetRouteExit) => void;
}

/** 내 완료한 공개 할 일에 받은 콕이 있으면 감사 요약 줄을 보여 준다. 할 일 동작 시트가 슬롯으로 받는다 */
export function TodoThanksSummary({ todo, onClose }: TodoThanksSummaryProps) {
  if (!NudgeInteractionPolicy.isThankableTodo(todo, { isOwner: true })) {
    return null;
  }

  return (
    <QueryErrorBoundary
      resetKeys={[todo.id]}
      fallback={(props) => (
        <ThanksSummaryRow.Error {...props} onInquiry={() => onClose(INQUIRY_SHEET_EXIT)} />
      )}
    >
      <Suspense fallback={null}>
        <ThanksSummaryRow
          todoId={todo.id}
          onThanksPress={() =>
            onClose({
              type: 'replace',
              href: { pathname: '/todo/[todoId]/thanks', params: { todoId: todo.id } },
            })
          }
        />
      </Suspense>
    </QueryErrorBoundary>
  );
}
