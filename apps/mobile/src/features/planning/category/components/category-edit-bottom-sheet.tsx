import { zodResolver } from '@hookform/resolvers/zod';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  INQUIRY_SHEET_EXIT,
  KeyboardBottomSheet,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';
import { useForm, useFormState } from 'react-hook-form';

import { TodoCategoryPolicy } from '../domains/todo-category.model';
import type { TodoCategory } from '../domains/todo-category.model';
import { useUpdateTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import { useGetTodoCategoriesQueryOptions } from '../queries/todo-category.queries';
import { todoCategoryFormSchema } from '../schemas/todo-category-form.schema';
import { todoCategoryParamsSchema } from '../schemas/todo-category-params.schema';
import { CategoryFormFields } from './category-form-fields';

type CategoryEditBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function CategoryEditBottomSheet(props: CategoryEditBottomSheetProps) {
  const sheet = useSheetRoute('/settings/category-settings');

  return (
    <KeyboardBottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary
        fallback={(fallbackProps) => (
          <CategoryEditBottomSheet.Error
            {...fallbackProps}
            onInquiry={() => sheet.close(INQUIRY_SHEET_EXIT)}
          />
        )}
      >
        <Suspense fallback={<CategoryEditBottomSheet.Loading />}>
          <CategoryEditBottomSheet.Contents onClose={() => sheet.close()} />
        </Suspense>
      </QueryErrorBoundary>
    </KeyboardBottomSheet>
  );
}

interface CategoryEditBottomSheetContentsProps {
  onClose: () => void;
}

CategoryEditBottomSheet.Contents = function Contents({
  onClose,
}: CategoryEditBottomSheetContentsProps) {
  const [{ categoryId }] = useRouteParams(todoCategoryParamsSchema);
  const { data: categoriesResult } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = useRetainedValue(
    TodoCategoryPolicy.findCategory(categoriesResult.categories, categoryId),
  );

  useEffect(() => {
    if (category == null) {
      onClose();
    }
  }, [category, onClose]);

  if (category == null) {
    return null;
  }

  return <CategoryEditForm category={category} onClose={onClose} />;
};

CategoryEditBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={40} pb={12}>
      <CategoryFormFields.Loading />
      <Skeleton className="h-14 w-full rounded-xl" />
    </VStack>
  );
};

CategoryEditBottomSheet.Error = function ErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: () => void }) {
  return <QueryErrorFallback reset={reset} onInquiry={onInquiry} />;
};

interface CategoryEditFormProps extends CategoryEditBottomSheetContentsProps {
  category: TodoCategory;
}

function CategoryEditForm({ category, onClose }: CategoryEditFormProps) {
  const { t } = useTranslation('common');
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const updateCategory = useMutation(useUpdateTodoCategoryMutationOptions());

  const form = useForm({
    resolver: zodResolver(todoCategoryFormSchema),
    defaultValues: { name: category.name, color: category.color },
  });
  const { isSubmitting } = useFormState({ control: form.control });

  // 실패하면 토스트는 mutation이 한 번 알리고 시트와 입력값은 그대로 둔다
  const submitCategory = form.handleSubmit(async (values) => {
    if (!TodoCategoryPolicy.hasChanges(category, values)) {
      onClose();

      return;
    }

    try {
      await updateCategory.mutateAsync({ id: category.id, input: values }, { onSuccess: onClose });
    } catch (error) {
      reportUnexpectedError(error);
    }
  });
  const handleSubmit = useSingleTap(() => submitCategory());

  return (
    <VStack gap={40} pb={12}>
      <CategoryFormFields control={form.control} onSubmit={handleSubmit} />

      <Button size="large" onPress={handleSubmit} isLoading={isSubmitting}>
        {t('actions.confirm')}
      </Button>
    </VStack>
  );
}
