import { createTodoSchema } from '@aido/validators';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { PlusIcon } from '@src/shared/ui/Icon';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatDate } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, Tabs } from 'heroui-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, View } from 'react-native';
import { type AddTodoFormInput, addTodoFormSchema } from '../../models/todo.model';
import { createTodoMutationOptions } from '../queries/create-todo-mutation-options';

interface AddTodoBottomSheetProps {
  selectedDate: Date;
}

export const AddTodoBottomSheet = ({ selectedDate }: AddTodoBottomSheetProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { control, handleSubmit, reset, watch, setValue } = useForm<AddTodoFormInput>({
    resolver: zodResolver(addTodoFormSchema),
    defaultValues: {
      title: '',
      scheduledTime: undefined,
      isAllDay: true,
      // TODO: 카테고리 선택 기능 추가 시 변경 필요, 개발 환경에 따라 다를 수 있습니다.
      categoryId: 2,
      visibility: 'PUBLIC',
    },
  });

  const visibility = watch('visibility');
  const createMutation = useMutation(createTodoMutationOptions());
  const toast = useAppToast();

  const onSubmit = (data: AddTodoFormInput) => {
    Keyboard.dismiss();

    const input = createTodoSchema.parse({ ...data, startDate: formatDate(selectedDate) });

    createMutation.mutate(input, {
      onSuccess: () => {
        reset();
        setIsOpen(false);
        toast.success('할 일이 추가되었어요!');
      },
      onError: () => {
        toast.error(undefined, { fallback: '할 일 추가에 실패했어요' });
      },
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
      <BottomSheet.Trigger className="absolute bottom-16 right-6 size-14 items-center justify-center rounded-full bg-main shadow-sm">
        <PlusIcon width={24} height={24} color="white" />
      </BottomSheet.Trigger>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          className="px-1"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheet.Title>
            <Text size="b3" weight="medium">
              할 일 추가
            </Text>
          </BottomSheet.Title>

          <Spacing size={12} />

          <VStack gap={12} pb={16}>
            {/* 제목 입력 */}
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <VStack gap={4}>
                  <View
                    className={`rounded-xl border bg-gray-1 px-3 py-2 ${error ? 'border-red-500' : 'border-gray-3'}`}
                  >
                    <BottomSheetTextInput
                      placeholder="할 일을 입력하세요"
                      value={value}
                      onChangeText={onChange}
                      style={{ fontSize: 16 }}
                      maxLength={200}
                    />
                  </View>
                  {error && (
                    <Text size="e1" className="text-red-500 px-1">
                      {error.message}
                    </Text>
                  )}
                </VStack>
              )}
            />

            {/* 시간 입력 */}
            <Controller
              control={control}
              name="scheduledTime"
              render={({ field: { onChange, value } }) => (
                <View className="rounded-xl border border-gray-3 bg-gray-1 px-3 py-2">
                  <BottomSheetTextInput
                    placeholder="시간 (선택, 예: 09:00)"
                    value={value ?? ''}
                    onChangeText={(text) => {
                      onChange(text || undefined);
                      setValue('isAllDay', !text);
                    }}
                    style={{ fontSize: 16 }}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              )}
            />

            {/* 공개 여부 */}
            <Controller
              control={control}
              name="visibility"
              render={({ field: { onChange } }) => (
                <HStack align="center" justify="between" className="py-2">
                  <Text size="b3" shade={7}>
                    공개 여부
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

            {/* 추가 버튼 */}
            <Button onPress={handleSubmit(onSubmit)} isLoading={createMutation.isPending}>
              추가하기
            </Button>
          </VStack>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};
