import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TodoCategory } from '@src/features/todo/models/todo-category.model';
import { useUpdateTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-update-todo-category-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheetInput,
  Button,
  Flex,
  HStack,
  KeyboardBottomSheet,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { CATEGORY_COLORS } from '../constants/todo-category.constants';

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
  const { t } = useTranslation(['todo', 'common']);
  const updateMutation = useMutation(useUpdateTodoCategoryMutationOptions());

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTodoCategoryInput>({
    resolver: zodResolver(createTodoCategorySchema),
    defaultValues: { name: category.name, color: category.color },
  });

  const onSubmit = (data: CreateTodoCategoryInput) => {
    updateMutation.mutate(
      { id: category.id, input: data },
      {
        onSuccess: onClose,
      },
    );
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={40} pb={12}>
        <VStack gap={20}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <BottomSheetInput
                autoFocus
                label={t('category.nameLabel')}
                placeholder={t('category.namePlaceholder')}
                value={value}
                onChangeText={onChange}
                isInvalid={!!errors.name}
                errorMessage={errors.name?.message}
                returnKeyType="done"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />
          <Controller
            control={control}
            name="color"
            render={({ field: { onChange, value } }) => (
              <HStack className="flex-wrap gap-2.5" align="center" justify="center">
                {CATEGORY_COLORS.map((color) => {
                  const isSelected = value === color;

                  return (
                    <PressableFeedback key={color} onPress={() => onChange(color)}>
                      <Flex
                        align="center"
                        justify="center"
                        className={cn('size-8 rounded-4xl', isSelected && 'border-2')}
                        style={isSelected ? { borderColor: color } : undefined}
                      >
                        <Flex
                          className={cn('rounded-4xl', isSelected ? 'size-6' : 'size-7')}
                          style={{ backgroundColor: color }}
                        />
                      </Flex>
                    </PressableFeedback>
                  );
                })}
              </HStack>
            )}
          />
        </VStack>

        <Button size="large" onPress={handleSubmit(onSubmit)} isLoading={updateMutation.isPending}>
          {t('common:actions.confirm')}
        </Button>
      </VStack>
    </KeyboardBottomSheet>
  );
};
