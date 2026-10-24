import {
  useTodoCreateCategoryParam,
  useTodoSheetDateParam,
} from '@src/features/todo/hooks/use-todo-sheet-params';
import { useSheetRoute } from '@src/shared/ui';
import { toDate } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';

import { useGetTodoCategoriesQueryOptions } from '../queries/get-todo-categories-query-options';
import { TODO_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { resolveSheetCategoryId } from '../utils/view-models/todo-sheet-target.view-model';
import { AddTodoBottomSheet } from './add-todo-bottom-sheet';

export function TodoCreateBottomSheet() {
  return (
    <Suspense fallback={null}>
      <TodoCreateBottomSheet.Form />
    </Suspense>
  );
}

TodoCreateBottomSheet.Form = function Form() {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);
  const [date] = useTodoSheetDateParam();
  const [requestedCategoryId] = useTodoCreateCategoryParam();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const categoryId = resolveSheetCategoryId(requestedCategoryId, categoriesResult.categories);

  useEffect(() => {
    if (categoryId == null) {
      sheet.exit();
    }
  }, [categoryId, sheet]);

  if (categoryId == null) {
    return null;
  }

  return (
    <AddTodoBottomSheet
      mode="create"
      selectedDate={toDate(date)}
      categoryId={categoryId}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
      onExit={() => sheet.exit()}
    />
  );
};
