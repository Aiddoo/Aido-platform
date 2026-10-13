import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTodoCategoryMutationOptions } from '@src/features/todo/queries/use-create-todo-category-mutation-options';
import { isApiError } from '@src/shared/errors';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheetInput,
  Button,
  KeyboardBottomSheet,
  PremiumDialog,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { DEFAULT_COLOR } from '../constants/todo-category-colors';
import { CategoryColorInput } from './category-color-input';

interface CategoryCreateBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  onExit: () => void;
}

export const CategoryCreateBottomSheet = ({
  isOpen,
  onOpenChange,
  onClose,
  onExit,
}: CategoryCreateBottomSheetProps) => {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation(['todo', 'common']);
  const createMutation = useMutation(useCreateTodoCategoryMutationOptions());
  const [premiumOpen, setPremiumOpen] = useState(false);

  const formMethods = useForm({
    resolver: zodResolver(createTodoCategorySchema),
    defaultValues: { name: '', color: DEFAULT_COLOR },
  });
  const { control, handleSubmit } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const onSubmit = async (data: CreateTodoCategoryInput) => {
    try {
      await createMutation.mutateAsync(data, {
        onSuccess: onClose,
        onError: (error) => {
          if (isApiError(error) && error.hasCode(ErrorCode.TODO_CATEGORY_0857)) {
            onClose();
            setPremiumOpen(true);
          }
        },
      });
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <>
        <KeyboardBottomSheet
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open && premiumOpen) {
              return;
            }
            onOpenChange(open);
          }}
        >
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

        <PremiumDialog
          isOpen={premiumOpen}
          onOpenChange={(open) => {
            if (!open) {
              setPremiumOpen(false);
              onExit();
            }
          }}
          onConfirm={onExit}
          description={t('category.premiumMore')}
        />
      </>
    </FormProvider>
  );
};
