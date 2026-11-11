import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { INQUIRY_SHEET_EXIT, QueryErrorBoundary, type SheetRouteExit } from '@src/shared/ui';
import { Suspense } from 'react';

import { TodoThanksPolicy } from '../../domains/nudge-interaction.model';
import { ThanksSummaryRow } from './thanks-summary-row';

interface TodoThanksSummaryProps {
  todo: Todo;
  onClose: (next?: SheetRouteExit) => void;
}

/** 내 완료한 공개 할 일에 받은 콕이 있으면 감사 요약 줄을 보여 준다. 할 일 동작 시트가 슬롯으로 받는다 */
export function TodoThanksSummary({ todo, onClose }: TodoThanksSummaryProps) {
  if (!TodoThanksPolicy.canThankTodo(todo, { canEditTodo: true })) {
    return null;
  }

  return (
    <QueryErrorBoundary
      resetKeys={[todo.id]}
      fallback={(fallbackProps) => (
        <ThanksSummaryRow.Error
          {...fallbackProps}
          // 시트 바탕이 다크에서 gray-1이라 안내 면을 한 단계 올려 구분한다
          className="dark:bg-gray-2"
          onInquiry={() => onClose(INQUIRY_SHEET_EXIT)}
        />
      )}
    >
      {/* 보낼 대상이 있는지 조회해야 보일지 아는 줄이라 로딩 때 자리를 잡지 않는다(ThanksSummaryRow 머리 주석) */}
      <Suspense fallback={null}>
        <ThanksSummaryRow
          todoId={todo.id}
          onOpenThanks={() =>
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
