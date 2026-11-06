import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useCreateTodoCategoryMutationOptions } from '@src/features/planning/todo/queries/use-create-todo-category-mutation-options';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheetInput,
  Button,
  KeyboardBottomSheet,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { FormProvider, useForm, useFormState } from 'react-hook-form';

import { DEFAULT_CATEGORY_COLOR } from '../constants/todo-category-colors';
import { TODO_CATEGORY_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { CategoryColorInput } from './category-color-input';

type CategoryCreateBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function CategoryCreateBottomSheet(props: CategoryCreateBottomSheetProps) {
  const reportUnexpectedError = useReportUnexpectedError('todo');
  const sheet = useSheetRoute(TODO_CATEGORY_SHEET_FALLBACK_HREF);

  const { t } = useTranslation(['todo', 'common']);
  const createMutation = useMutation(useCreateTodoCategoryMutationOptions());
  const gate = useEntitlementGate('TODO_CATEGORY', { surface: 'category_create' });

  const formMethods = useForm({
    resolver: zodResolver(createTodoCategorySchema),
    defaultValues: { name: '', color: DEFAULT_CATEGORY_COLOR },
  });
  const { control, handleSubmit } = formMethods;
  const { isSubmitting } = useFormState({ control });

  const handleSubmitCategory = async (values: CreateTodoCategoryInput) => {
    try {
      await createMutation.mutateAsync(values, {
        onSuccess: () => sheet.close(),
        // 시트 route 안의 Overlay에 띄워 시트 위에 보인다. 구독하러 가면 시트를 바로 떠난다
        onError: (error) => gate.handleError(error, { onSubscribe: sheet.exit }),
      });
    } catch (error) {
      reportUnexpectedError(error);
    }
  };

  return (
    <KeyboardBottomSheet {...props} isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange}>
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
                  onSubmitEditing={() => handleSubmit(handleSubmitCategory)()}
                />
              )}
            </FormField>
            <FormField control={control} name="color">
              {({ onChange, value }) => <CategoryColorInput value={value} onChange={onChange} />}
            </FormField>
          </VStack>

          <Button
            size="large"
            onPress={() => handleSubmit(handleSubmitCategory)()}
            isLoading={isSubmitting}
          >
            {t('common:actions.confirm')}
          </Button>
        </VStack>
      </FormProvider>
    </KeyboardBottomSheet>
  );
}
