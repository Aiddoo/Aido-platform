import { useTranslation } from '@src/shared/i18n';
import { ScreenTitleBar } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useTodoScreenParams } from '../hooks/use-todo-screen-params';
import { useTodoDetailsQueryOptions } from '../queries/use-todo-page-query-options';

/** 할 일 상세의 최상단 바. 조회수가 살아 있는 값이라 네이티브 헤더 대신 화면 안에서 그린다. */
export function TodoDetailTitleBar() {
  const { t } = useTranslation('todo');
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));

  return (
    <ScreenTitleBar
      title={t('detail.pageTitle')}
      subtitle={t('detail.views', { count: detail.metrics.viewCount })}
    />
  );
}

TodoDetailTitleBar.Loading = function Loading() {
  return <ScreenTitleBar.Loading hasSubtitle />;
};
