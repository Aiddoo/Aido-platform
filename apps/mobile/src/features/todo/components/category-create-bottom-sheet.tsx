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
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { type ComponentProps, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { DEFAULT_COLOR } from '../constants/todo-category-colors';
import { TODO_CATEGORY_SHEET_FALLBACK_HREF } from '../utils/navigation/todo-sheet-href';
import { CategoryColorInput } from './category-color-input';

type CategoryCreateBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 카테고리 추가 시트(`/todo-categories/new`). 개수 제한에 걸리면 시트를 닫고 구독 안내를 띄운다. */
export function CategoryCreateBottomSheet(props: CategoryCreateBottomSheetProps) {
  const { showBoundary } = useErrorBoundary();
  const sheet = useSheetRoute(TODO_CATEGORY_SHEET_FALLBACK_HREF);

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
        onSuccess: () => sheet.close(),
        onError: (error) => {
          if (isApiError(error) && error.hasCode(ErrorCode.TODO_CATEGORY_0857)) {
            sheet.close();
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
          {...props}
          isOpen={sheet.isOpen}
          onOpenChange={(open) => {
            if (!open && premiumOpen) {
              return;
            }
            sheet.onOpenChange(open);
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
              sheet.exit();
            }
          }}
          onConfirm={() => sheet.exit()}
          description={t('category.premiumMore')}
        />
      </>
    </FormProvider>
  );
}
