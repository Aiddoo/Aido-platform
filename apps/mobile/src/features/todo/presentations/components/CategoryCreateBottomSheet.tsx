import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/create-todo-category-mutation-options';
import { useAppToast } from '@src/shared/hooks/useAppToast';
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
import { CATEGORY_COLORS, DEFAULT_COLOR } from '../constants/todo-category.constants';

interface CategoryCreateBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const CategoryCreateBottomSheet = ({
  isOpen,
  onOpenChange,
}: CategoryCreateBottomSheetProps) => {
  const toast = useAppToast();
  const createMutation = useMutation(createTodoCategoryMutationOptions());

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTodoCategoryInput>({
    resolver: zodResolver(createTodoCategorySchema),
    defaultValues: { name: '', color: DEFAULT_COLOR },
  });

  const onSubmit = (data: CreateTodoCategoryInput) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success('카테고리를 추가했어요');
        onOpenChange(false);
      },
      onError: () => {
        toast.error(undefined, { fallback: '잠시 후 다시 추가해 보세요' });
      },
    });
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={40}>
        <VStack gap={20}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <BottomSheetInput
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
              <HStack className="flex-wrap gap-2.5">
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
          />
        </VStack>

        <Button size="large" onPress={handleSubmit(onSubmit)} isLoading={createMutation.isPending}>
          확인
        </Button>
      </VStack>
    </KeyboardBottomSheet>
  );
};
