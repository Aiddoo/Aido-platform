import homeIdoCatImage from '@assets/images/home_ido_cat.webp';
import type { ParsedTodoData } from '@src/features/todo/models/todo.model';
import { AddTodoBottomSheet } from '@src/features/todo/presentations/components/AddTodoBottomSheet';
import { getTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/get-todo-categories-query-options';
import { parseTodoMutationOptions } from '@src/features/todo/presentations/queries/parse-todo-mutation-options';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSpeechRecognition } from '@src/shared/hooks/useSpeechRecognition';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { useOverlay } from '@src/shared/ui/Overlay';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VoiceTextField } from '@src/shared/ui/VoiceTextField/VoiceTextField';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 16;

const HomeScreen = () => {
  const [inputText, setInputText] = useState('');

  const toast = useAppToast();
  const overlay = useOverlay();

  const { isRecognizing, start, stop } = useSpeechRecognition({
    onResult: setInputText,
    onError: toast.error,
  });

  const parseMutation = useMutation(parseTodoMutationOptions());
  const { data: categoriesData } = useQuery(getTodoCategoriesQueryOptions());
  const defaultCategoryId = categoriesData?.categories[0]?.id;

  const handleMicPress = () => {
    isRecognizing ? stop() : start();
  };

  const openTodoSheet = (data: ParsedTodoData) => {
    if (!defaultCategoryId) return;

    overlay.open(({ isOpen, close, exit }) => (
      <AddTodoBottomSheet
        mode="create"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        onClose={close}
        selectedDate={new Date(data.startDate)}
        categoryId={defaultCategoryId}
        initialValues={{
          title: data.title,
          scheduledTime: data.scheduledTime,
          isAllDay: data.isAllDay,
          endDate: data.endDate ? new Date(data.endDate) : null,
        }}
        onSuccess={() => {
          setInputText('');
        }}
      />
    ));
  };

  const handleSubmit = () => {
    if (!inputText.trim()) return;

    Keyboard.dismiss();

    parseMutation.mutate(inputText.trim(), {
      onSuccess: (result) => {
        openTodoSheet(result.data);
      },
    });
  };

  const handleExamplePress = (text: string) => {
    setInputText(text);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className="bg-white"
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
            source={homeIdoCatImage}
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
