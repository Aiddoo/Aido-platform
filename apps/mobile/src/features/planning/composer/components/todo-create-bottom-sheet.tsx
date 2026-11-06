import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
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

import { AddTodoBottomSheet } from './add-todo-bottom-sheet';

/** 기본 카테고리가 폼 기본값을 정하므로, 카테고리를 읽는 동안에는 시트를 띄우지 않아 폼이 열린 뒤 바뀌지 않게 한다. */
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
  const sheet = useSheetRoute('/feed');
  const date = useTodoSheetDateParam();
  const requestedCategoryId = useTodoCreateCategoryParam();
  const prefill = useTodoCreatePrefillParam();
  const isVoiceHintForced = useTodoCreateVoiceHintParam();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const categoryId = TodoCategoryPolicy.getInitialCategoryId(
    categoriesResult.categories,
    requestedCategoryId,
  );

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
