import { ErrorCode } from '@aido/errors';
import { type CreateTodoCategoryInput, createTodoCategorySchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateTodoCategoryMutationOptions } from '@src/features/todo/presentations/queries/use-create-todo-category-mutation-options';
import { isApiError } from '@src/shared/errors';
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex';
import { HStack } from '@src/shared/ui/HStack';
import { BottomSheetInput } from '@src/shared/ui/Input';
import { PremiumDialog } from '@src/shared/ui/PremiumDialog/PremiumDialog';
import { VStack } from '@src/shared/ui/VStack';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
  const createMutation = useMutation(useCreateTodoCategoryMutationOptions());
  const [premiumOpen, setPremiumOpen] = useState(false);

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
      onSuccess: onClose,
      onError: (error) => {
        if (isApiError(error) && error.hasCode(ErrorCode.TODO_CATEGORY_0857)) {
          onClose();
          setPremiumOpen(true);
        }
      },
    });
  };

  return (
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

          <Button
            size="large"
            onPress={handleSubmit(onSubmit)}
            isLoading={createMutation.isPending}
          >
            확인
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
        description="프리미엄 구독으로 더 많은 카테고리를 만들 수 있어요"
      />
    </>
  );
};
