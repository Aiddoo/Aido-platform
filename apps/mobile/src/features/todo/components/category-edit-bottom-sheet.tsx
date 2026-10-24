import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TodoCategory } from '@src/features/todo/domains/todo-category.model';
import { useTodoCategoryScreenParams } from '@src/features/todo/hooks/use-todo-sheet-params';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useUpdateTodoCategoryMutationOptions } from '@src/features/todo/queries/use-update-todo-category-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheetInput,
  Button,
  KeyboardBottomSheet,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense, useEffect } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { TODO_CATEGORY_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { findSheetCategory } from '../utils/view-models/todo-sheet-target.view-model';
import { CategoryColorInput } from './category-color-input';

type CategoryEditBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 카테고리 수정 시트. 대상은 `/todo-categories/[categoryId]/edit` route에서 읽는다. */
export function CategoryEditBottomSheet(props: CategoryEditBottomSheetProps) {
  const sheet = useSheetRoute(TODO_CATEGORY_SHEET_FALLBACK_HREF);

  return (
    <KeyboardBottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
      <QueryErrorBoundary fallback={CategoryEditBottomSheet.Error}>
        <Suspense fallback={<CategoryEditBottomSheet.Loading />}>
          <CategoryEditBottomSheet.Content onClose={() => sheet.close()} />
        </Suspense>
      </QueryErrorBoundary>
    </KeyboardBottomSheet>
  );
}

interface SheetContentProps {
  onClose: () => void;
}

CategoryEditBottomSheet.Content = function Content({ onClose }: SheetContentProps) {
  const { categoryId } = useTodoCategoryScreenParams();
  const { data } = useSuspenseQuery(useGetTodoCategoriesQueryOptions());
  const category = useRetainedValue(findSheetCategory(data.categories, categoryId));

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
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </VStack>
  );
};

CategoryEditBottomSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');
  return (
    <Result
      title={t('errorBoundary.title')}
      button={<Result.Button onPress={reset}>{t('errorBoundary.retry')}</Result.Button>}
    />
  );
};

interface CategoryEditFormProps extends SheetContentProps {
  category: TodoCategory;
}

function CategoryEditForm({ category, onClose }: CategoryEditFormProps) {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation(['todo', 'common']);
  const updateMutation = useMutation(useUpdateTodoCategoryMutationOptions());

  const formMethods = useForm({
    resolver: zodResolver(createTodoCategorySchema),
    defaultValues: { name: category.name, color: category.color },
  });
  const { control, handleSubmit } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const onSubmit = async (data: CreateTodoCategoryInput) => {
    try {
      await updateMutation.mutateAsync({ id: category.id, input: data }, { onSuccess: onClose });
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <VStack gap={40} pb={12}>
        <VStack gap={20}>
          <FormField control={control} name="name">
            {({ onChange, value }, { error }) => (
              <BottomSheetInput
                autoFocus
                label={t('category.nameLabel')}
                placeholder={t('category.namePlaceholder')}
                value={value}
                onChange={onChange}
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, {
                  default: 'categoryName.required',
                  byType: { too_big: 'categoryName.tooLong' },
                })}
                returnKeyType="done"
                onSubmitEditing={() => handleSubmit(onSubmit)()}
              />
            )}
          </FormField>
          <FormField control={control} name="color">
            {({ onChange, value }) => <CategoryColorInput value={value} onChange={onChange} />}
          </FormField>
        </VStack>

        <Button size="large" onPress={() => handleSubmit(onSubmit)()} isLoading={isSubmitting}>
          {t('common:actions.confirm')}
        </Button>
      </VStack>
    </FormProvider>
  );
}
