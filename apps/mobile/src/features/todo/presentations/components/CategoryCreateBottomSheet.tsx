import { ErrorCode } from '@aido/errors';
import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-create-todo-category-mutation-options';
import { isApiError } from '@src/shared/errors';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheetInput,
  Button,
  Flex,
  HStack,
  KeyboardBottomSheet,
  PremiumDialog,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { CATEGORY_COLORS, DEFAULT_COLOR } from '../constants/todo-category.constants';

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
      if (!isBusinessError(error)) showBoundary(error);
    }
  };

  return (
    <FormProvider {...formMethods}>
      <>
        <KeyboardBottomSheet
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open && premiumOpen) return;
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
                {({ onChange, value }) => (
                  <HStack className="flex-wrap gap-2.5" align="center" justify="center">
                    {CATEGORY_COLORS.map((color) => {
                      const isSelected = value === color;

                      return (
                        <PressableFeedback key={color} onPress={() => onChange(color)}>
                          <Flex
                            align="center"
                            justify="center"
                            className={cn('size-8 rounded-full', isSelected && 'border-2')}
                            style={isSelected ? { borderColor: color } : undefined}
                          >
                            <Flex
                              className={cn('rounded-full', isSelected ? 'size-6' : 'size-7')}
                              style={{ backgroundColor: color }}
                            />
                          </Flex>
                        </PressableFeedback>
                      );
                    })}
                  </HStack>
                )}
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
