import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useTodoSheetDateParam } from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/get-todos-by-date-query-options';
import { findSheetTodo } from '@src/features/planning/todo/utils/view-models/todo-sheet-target.view-model';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  INQUIRY_SHEET_EXIT,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useSheetRoute,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { type ComponentProps, Suspense, useEffect } from 'react';

import { useGetTodoSeriesQueryOptions } from '../queries/get-todo-series-query-options';
import { AddTodoBottomSheet } from './add-todo-bottom-sheet';

/** 키보드 시트가 폼 기본값을 할 일로 정하므로, 할 일을 읽는 동안에는 시트를 띄우지 않는다. */
export function TodoEditBottomSheet() {
  return (
    <QueryErrorBoundary fallback={TodoEditBottomSheet.Error}>
      <Suspense fallback={null}>
        <TodoEditBottomSheet.Form />
      </Suspense>
    </QueryErrorBoundary>
  );
}

TodoEditBottomSheet.Form = function Form() {
  const sheet = useSheetRoute('/feed');
  const { todoId } = useTodoScreenParams();
  const [date] = useTodoSheetDateParam();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(findSheetTodo(todosByDate.todos, todoId));

  useEffect(() => {
    if (todo == null) {
      sheet.exit();
    }
  }, [todo, sheet]);

  if (todo == null) {
    return null;
  }

  const sheetProps = {
    isOpen: sheet.isOpen,
    onOpenChange: sheet.onOpenChange,
    onClose: () => sheet.close(),
    onExit: () => sheet.exit(),
  };

  // 규칙은 목록 응답에 실려 있다. 구 서버 응답처럼 규칙이 없는 회차만 따로 읽는다
  return todo.repeat == null && todo.recurrenceGroupId != null ? (
    <TodoEditBottomSheet.SeriesForm todo={todo} seriesId={todo.recurrenceGroupId} {...sheetProps} />
  ) : (
    <AddTodoBottomSheet mode="edit" todo={todo} {...sheetProps} />
  );
};

type SeriesFormProps = Omit<ComponentProps<typeof AddTodoBottomSheet>, 'mode' | 'repeat'> & {
  todo: Todo;
  seriesId: string;
};

/** 편집 폼의 기본값이 규칙이라, 반복 할 일은 규칙을 읽은 뒤에 시트를 띄운다. */
TodoEditBottomSheet.SeriesForm = function SeriesForm({
  todo,
  seriesId,
  ...sheetProps
}: SeriesFormProps) {
  const { data: series } = useSuspenseQuery(useGetTodoSeriesQueryOptions({ seriesId }));

  return (
    <AddTodoBottomSheet
      {...sheetProps}
      mode="edit"
      todo={todo}
      repeat={series == null ? null : series.repeat}
    />
  );
};

TodoEditBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  const sheet = useSheetRoute('/feed');

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <Result
        title={t('errorBoundary.title')}
        button={
          <QueryErrorActions onRetry={reset} onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)} />
        }
      />
    </BottomSheet>
  );
};
