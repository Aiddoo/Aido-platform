import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TodoCategory } from '@src/features/todo/models/todo-category.model';
import { updateTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/update-todo-category-mutation-options';
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { BottomSheetInput } from '@src/shared/ui/Input';
import { VStack } from '@src/shared/ui/VStack/VStack';
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
  const updateMutation = useMutation(updateTodoCategoryMutationOptions());

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
                label="카테고리 이름"
                placeholder="카테고리 이름을 입력해 주세요"
                value={value}
                onChangeText={onChange}
                isInvalid={!!errors.name}
                errorMessage={errors.name?.message}
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
          확인
        </Button>
      </VStack>
    </KeyboardBottomSheet>
  );
};
