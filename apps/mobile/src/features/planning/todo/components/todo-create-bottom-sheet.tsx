import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/get-todo-categories-query-options';
import {
  useTodoCreateCategoryParam,
  useTodoCreatePrefillParam,
  useTodoCreateVoiceHintParam,
  useTodoSheetDateParam,
} from '@src/features/planning/todo/hooks/use-todo-sheet-params';
import { toDate } from '@src/shared/date/instant';
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
import { Suspense, useEffect } from 'react';

import { TODO_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { resolveSheetCategoryId } from '../utils/view-models/todo-sheet-target.view-model';
import { AddTodoBottomSheet } from './add-todo-bottom-sheet';

export function TodoCreateBottomSheet() {
  return (
    <QueryErrorBoundary fallback={TodoCreateBottomSheet.Error}>
      <Suspense fallback={null}>
        <TodoCreateBottomSheet.Form />
      </Suspense>
    </QueryErrorBoundary>
  );
}

TodoCreateBottomSheet.Form = function Form() {
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);
  const [date] = useTodoSheetDateParam();
  const [requestedCategoryId] = useTodoCreateCategoryParam();
  const [prefill] = useTodoCreatePrefillParam();
  const isVoiceHintForced = useTodoCreateVoiceHintParam();
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
      isVoiceHintForced={isVoiceHintForced}
      initialValues={{
        title: prefill.title,
        scheduledTime: prefill.time ?? null,
        isAllDay: prefill.time == null,
      }}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
      onExit={() => sheet.exit()}
    />
  );
};

TodoCreateBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  const sheet = useSheetRoute(TODO_SHEET_FALLBACK_HREF);

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
