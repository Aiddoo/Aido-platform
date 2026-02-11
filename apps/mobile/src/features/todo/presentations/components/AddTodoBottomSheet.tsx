import { createTodoSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { BottomSheetInput } from '@src/shared/ui/Input';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { createTodoMutationOptions } from '../queries/create-todo-mutation-options';
import { type AddTodoFormInput, addTodoFormSchema } from '../schemas/add-todo-form.schema';

interface AddTodoBottomSheetProps {
  selectedDate: Date;
  categoryId: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const AddTodoBottomSheet = ({
  selectedDate,
  categoryId,
  isOpen,
  onOpenChange,
}: AddTodoBottomSheetProps) => {
  const { control, handleSubmit, watch, setValue } = useForm<AddTodoFormInput>({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues: {
      title: '',
      scheduledTime: undefined,
      isAllDay: true,
      categoryId,
      visibility: 'PUBLIC',
    },
  });

  const visibility = watch('visibility');
  const createMutation = useMutation(createTodoMutationOptions());

  const onSubmit = (data: AddTodoFormInput) => {
    Keyboard.dismiss();

    const input = createTodoSchema.parse({ ...data, startDate: formatDate(selectedDate) });

    createMutation.mutate(input, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={16}>
        <VStack gap={12} pb={16}>
          {/* 제목 입력 */}
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <BottomSheetInput
                placeholder="할 일을 입력해 주세요"
                value={value}
                onChangeText={onChange}
                maxLength={200}
                isInvalid={!!error}
                errorMessage={error?.message}
              />
            )}
          />

          {/* 시간 입력 */}
          <Controller
            control={control}
            name="scheduledTime"
            render={({ field: { onChange, value } }) => (
              <BottomSheetInput
                placeholder="시간 (선택, 예: 09:00)"
                value={value ?? ''}
                onChangeText={(text) => {
                  onChange(text || undefined);
                  setValue('isAllDay', !text);
                }}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            )}
          />

          {/* 공개 여부 */}
          <Controller
            control={control}
            name="visibility"
            render={({ field: { onChange } }) => (
              <HStack align="center" justify="between" className="py-2">
                <Text size="b3" shade={7}>
                  공개할까요?
                </Text>
                <Tabs value={visibility ?? 'PUBLIC'} onValueChange={(tab) => onChange(tab)}>
                  <Tabs.List className="bg-gray-2 rounded-full p-1">
                    <Tabs.Indicator className="bg-gray-9 rounded-full" />
                    <Tabs.Trigger value="PUBLIC" className="px-4 py-2">
                      {({ isSelected }) => (
                        <Text
                          size="b4"
                          weight="medium"
                          tone={isSelected ? 'white' : undefined}
                          shade={isSelected ? undefined : 6}
                        >
                          공개
                        </Text>
                      )}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="PRIVATE" className="px-4 py-2">
                      {({ isSelected }) => (
                        <Text
                          size="b4"
                          weight="medium"
                          tone={isSelected ? 'white' : undefined}
                          shade={isSelected ? undefined : 6}
                        >
                          비공개
                        </Text>
                      )}
                    </Tabs.Trigger>
                  </Tabs.List>
                </Tabs>
              </HStack>
            )}
          />

          <Spacing size={4} />

          <Button
            size="large"
            onPress={handleSubmit(onSubmit)}
            isLoading={createMutation.isPending}
          >
            추가하기
          </Button>
        </VStack>
      </VStack>
    </KeyboardBottomSheet>
  );
};
