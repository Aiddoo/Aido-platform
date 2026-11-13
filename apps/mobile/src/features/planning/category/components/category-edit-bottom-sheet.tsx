import { zodResolver } from '@hookform/resolvers/zod';
import { SERVER_VALUES_RESET_OPTIONS } from '@src/shared/constants/server-values-reset-options';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Button,
  KeyboardBottomSheet,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  useSheetRoute,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type ComponentProps, Suspense, useEffect } from 'react';
import { useForm, useFormState } from 'react-hook-form';

import { toTodoCategoryFormValues } from '../apis/todo-category.mapper';
import { type TodoCategory, TodoCategoryPolicy } from '../domains/todo-category.model';
import { useTodoCategoryId } from '../hooks/use-todo-category-id';
import { useUpdateTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import { useGetTodoCategoriesQueryOptions } from '../queries/todo-category.queries';
import { todoCategoryFormSchema } from '../schemas/todo-category-form.schema';
import { CategoryFormFields } from './category-form-fields';

type CategoryEditBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 주 동작 버튼을 키보드 위 고정 영역(`footer`)에 두려면 폼이 시트를 가져야 하므로, 할 일 고치기 시트처럼 읽는 동안에는 시트를 띄우지 않는다 */
export function CategoryEditBottomSheet(props: CategoryEditBottomSheetProps) {
  return (
    <QueryErrorBoundary fallback={CategoryEditBottomSheet.Error}>
      <Suspense fallback={null}>
        <CategoryEditBottomSheet.Form {...props} />
      </Suspense>
    </QueryErrorBoundary>
  );
}

CategoryEditBottomSheet.Form = function Form(props: CategoryEditBottomSheetProps) {
  const sheet = useSheetRoute('/settings/category-settings');
  const [categoryId] = useTodoCategoryId();
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = useRetainedValue(
    TodoCategoryPolicy.findCategory(categoriesResult.categories, categoryId),
  );

  useEffect(() => {
    if (category == null) {
      sheet.close();
    }
  }, [category, sheet]);

  if (category == null) {
    return null;
  }

  return (
    <CategoryEditForm
      {...props}
      category={category}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      onClose={() => sheet.close()}
    />
  );
};

CategoryEditBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const sheet = useSheetRoute('/settings/category-settings');

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorFallback
        reset={reset}
        onInquiry={(href) => sheet.close({ type: 'dismiss-to', href })}
      />
    </BottomSheet>
  );
};

interface CategoryEditFormProps extends Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children'
> {
  category: TodoCategory;
  onClose: () => void;
}

function CategoryEditForm({ category, onClose, ...props }: CategoryEditFormProps) {
  const { t } = useTranslation('common');
  const updateCategory = useMutation(useUpdateTodoCategoryMutationOptions());

  // 다시 받은 카테고리로 비교 기준을 맞춘다. 고치지 않은 칸은 새 값을 보이고 고치던 칸은 남는다
  const form = useForm({
    resolver: zodResolver(todoCategoryFormSchema),
    values: toTodoCategoryFormValues(category),
    resetOptions: SERVER_VALUES_RESET_OPTIONS,
    mode: 'onChange',
  });
  const { isSubmitting } = useFormState({ control: form.control });

  // 실패하면 토스트는 mutation이 한 번 알리고 시트와 입력값은 그대로 둔다
  const submitCategory = form.handleSubmit(async (values) => {
    if (!TodoCategoryPolicy.hasChanges(category, values)) {
      onClose();

      return;
    }

    await updateCategory
      .mutateAsync({ id: category.id, input: values }, { onSuccess: onClose })
      .catch(noop);
  });
  const handleSubmit = useSingleTap(() => submitCategory());

  return (
    <KeyboardBottomSheet
      {...props}
      footer={
        <Button size="large" onPress={handleSubmit} isLoading={isSubmitting}>
          {t('actions.confirm')}
        </Button>
      }
    >
      <CategoryFormFields control={form.control} onSubmit={handleSubmit} />
    </KeyboardBottomSheet>
  );
}
