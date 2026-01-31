import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParsedTodoData } from '@src/features/todo/models/todo.model';
import { createTodoMutationOptions } from '@src/features/todo/presentations/queries/create-todo-mutation-options';
import { parseTodoMutationOptions } from '@src/features/todo/presentations/queries/parse-todo-mutation-options';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSpeechRecognition } from '@src/shared/hooks/useSpeechRecognition';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VoiceTextField } from '@src/shared/ui/VoiceTextField/VoiceTextField';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, PressableFeedback } from 'heroui-native';
import { type PropsWithChildren, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { z } from 'zod';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 16;

const HomeScreen = () => {
  const [inputText, setInputText] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTodoData | null>(null);

  const toast = useAppToast();

  const { isRecognizing, start, stop } = useSpeechRecognition({
    onResult: setInputText,
    onError: toast.error,
  });

  const parseMutation = useMutation(parseTodoMutationOptions());
  const createMutation = useMutation(createTodoMutationOptions());

  const handleMicPress = () => {
    isRecognizing ? stop() : start();
  };

  const handleSubmit = () => {
    if (!inputText.trim()) return;

    Keyboard.dismiss();

    parseMutation.mutate(inputText.trim(), {
      onSuccess: (result) => {
        setParsedData(result.data);
        setIsSheetOpen(true);
      },
    });
  };

  const handleExamplePress = (text: string) => {
    setInputText(text);
  };

  const handleCreateTodo = ({ title, startDate, scheduledTime, isAllDay }: ParsedTodoData) => {
    createMutation.mutate(
      {
        title,
        startDate,
        scheduledTime,
        isAllDay,
        visibility: 'PUBLIC',
        // TODO: 카테고리 선택 기능 추가 시 변경 필요, 개발 환경에 따라 다를 수 있습니다.
        categoryId: 1,
      },
      {
        onSuccess: () => {
          setInputText('');
          setParsedData(null);
          setIsSheetOpen(false);
          toast.success('할 일이 추가되었어요!');
        },
        onError: (err) => {
          toast.error(err.message, { fallback: '할 일 추가에 실패했어요' });
        },
      },
    );
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'white' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Spacing size={20} />

          <ExampleTexts onPress={handleExamplePress} />

          <Spacing size={32} />

          <VStack align="center" gap={8}>
            <Text size="t1" weight="bold" className="text-center">
              생각나는 대로{'\n'}적거나 말씀하세요!
            </Text>
          </VStack>

          <Spacing size={24} />

          <VStack align="center">
            <Image
              source={require('@assets/images/home_ido_cat.webp')}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
          </VStack>

          <View style={{ flex: 1 }} />

          <View style={{ paddingBottom: TAB_BAR_HEIGHT }}>
            <VoiceTextField
              value={inputText}
              onChangeText={setInputText}
              onMicPress={handleMicPress}
              onSubmit={handleSubmit}
              isRecognizing={isRecognizing}
              isLoading={parseMutation.isPending}
              placeholder="예시) 매주 금요일 밤 11시 분리수거"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ParsedTodoConfirmSheet
        key={parsedData?.title ?? 'empty'}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        parsedData={parsedData}
        onConfirm={handleCreateTodo}
        isLoading={createMutation.isPending}
      />
    </>
  );
};

export default HomeScreen;

const EXAMPLE_TEXTS = [
  '내일 오후 3시 치과 예약',
  '매주 월요일 아침 운동',
  '다음 주 금요일까지 보고서 제출',
  '오늘 저녁 장보기',
];

interface ExampleTextsProps {
  onPress: (text: string) => void;
}

const ExampleTexts = ({ onPress }: ExampleTextsProps) => {
  return (
    <VStack gap={8}>
      <Text size="b4" shade={6} className="px-2">
        예시
      </Text>
      <HStack gap={8} className="flex-wrap">
        {EXAMPLE_TEXTS.map((text) => (
          <PressableFeedback
            key={text}
            onPress={() => onPress(text)}
            className="bg-white rounded-full px-4 py-2 border border-gray-3"
          >
            <Text size="b4" shade={7}>
              {text}
            </Text>
          </PressableFeedback>
        ))}
      </HStack>
    </VStack>
  );
};

const confirmFormSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  startDate: z.string(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
});

type ConfirmFormInput = z.infer<typeof confirmFormSchema>;

interface ParsedTodoConfirmSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedTodoData | null;
  onConfirm: (data: ParsedTodoData) => void;
  isLoading: boolean;
}

const ParsedTodoConfirmSheet = ({
  isOpen,
  onOpenChange,
  parsedData,
  onConfirm,
  isLoading,
}: ParsedTodoConfirmSheetProps) => {
  const { control, handleSubmit } = useForm<ConfirmFormInput>({
    resolver: zodResolver(confirmFormSchema),
    defaultValues: {
      title: parsedData?.title ?? '',
      startDate: parsedData?.startDate ?? '',
      scheduledTime: parsedData?.scheduledTime ?? null,
      isAllDay: parsedData?.isAllDay ?? true,
    },
  });

  const handleConfirm = (data: ConfirmFormInput) => {
    onConfirm({
      title: data.title,
      startDate: data.startDate,
      endDate: null,
      scheduledTime: data.scheduledTime,
      isAllDay: data.isAllDay,
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
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
              할 일 확인
            </Text>
          </BottomSheet.Title>

          <Spacing size={12} />

          <VStack gap={16} pb={16}>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <ConfirmFormField label="할 일" error={error?.message}>
                  <BottomSheetTextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="할 일을 입력하세요"
                    style={{ fontSize: 16 }}
                    maxLength={200}
                  />
                </ConfirmFormField>
              )}
            />

            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, value } }) => (
                <ConfirmFormField label="날짜">
                  <BottomSheetTextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="YYYY-MM-DD"
                    style={{ fontSize: 16 }}
                  />
                </ConfirmFormField>
              )}
            />

            <Controller
              control={control}
              name="scheduledTime"
              render={({ field: { onChange, value } }) => (
                <ConfirmFormField label="시간 (선택)">
                  <BottomSheetTextInput
                    value={value ?? ''}
                    onChangeText={(text) => onChange(text || null)}
                    placeholder="HH:mm"
                    style={{ fontSize: 16 }}
                    keyboardType="numbers-and-punctuation"
                  />
                </ConfirmFormField>
              )}
            />

            <Spacing size={8} />

            <Button onPress={handleSubmit(handleConfirm)} isLoading={isLoading}>
              추가하기
            </Button>
          </VStack>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

interface ConfirmFormFieldProps {
  label: string;
  error?: string;
}

const ConfirmFormField = ({ label, error, children }: PropsWithChildren<ConfirmFormFieldProps>) => {
  return (
    <VStack gap={4}>
      <Text size="b4" shade={6} className="px-1">
        {label}
      </Text>
      <View
        className={`rounded-xl border bg-gray-1 px-3 py-2 ${
          error ? 'border-red-500' : 'border-gray-3'
        }`}
      >
        {children}
      </View>
      {error && (
        <Text size="e1" tone="danger" className="px-1">
          {error}
        </Text>
      )}
    </VStack>
  );
};
