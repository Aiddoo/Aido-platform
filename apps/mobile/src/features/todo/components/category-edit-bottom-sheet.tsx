import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TodoCategory } from '@src/features/todo/domains/todo-category.model';
import { useUpdateTodoCategoryMutationOptions } from '@src/features/todo/queries/use-update-todo-category-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { BottomSheetInput, Button, KeyboardBottomSheet, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { CategoryColorInput } from './category-color-input';

interface CategoryEditBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  category: TodoCategory;
}

export const CategoryEditBottomSheet = ({
  isOpen,
  onOpenChange,
  onClose,
  category,
}: CategoryEditBottomSheetProps) => {
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
      await updateMutation.mutateAsync(
        { id: category.id, input: data },
        {
          onSuccess: onClose,
        },
      );
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
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
      </KeyboardBottomSheet>
    </FormProvider>
  );
};
