import {
  type CreateInquiryInput,
  createInquirySchema,
  INQUIRY_CATEGORY,
  INQUIRY_CONTENT_LIMITS,
} from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { INQUIRY_CATEGORY_LABELS } from '@src/features/inquiry/presentations/constants/inquiry-category-labels.constant';
import { useCreateInquiryMutationOptions } from '@src/features/inquiry/presentations/queries/use-create-inquiry-mutation-options';
import {
  H3,
  HStack,
  KeyboardAdaptiveButton,
  ListRow,
  Spacing,
  Text,
  TextArea,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Radio, RadioGroup } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { scrollTo, useAnimatedRef, useSharedValue } from 'react-native-reanimated';

const CONTENT_PLACEHOLDER = `문의 내용을 자세히 작성해주세요.

예시:
- 사용 기기: iPhone 16 Pro, Galaxy S25
- 발생 상황: 할 일 추가 시 앱이 종료됨
- 발생 시점: 2026년 3월 14일 오후 3시경

상세하게 작성할수록 빠르게 도움을 드릴 수 있어요.`;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const InquiryScreen = () => {
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const hasScrolled = useSharedValue(false);

  const createInquiryMutation = useMutation(useCreateInquiryMutationOptions());

  useKeyboardHandler({
    onStart: () => {
      'worklet';
      hasScrolled.value = false;
    },
    onMove: (e) => {
      'worklet';
      if (e.height > 0 && !hasScrolled.value) {
        hasScrolled.value = true;
        scrollTo(scrollViewRef, 0, 9999, true);
      }
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateInquiryInput>({
    resolver: zodResolver(createInquirySchema),
    defaultValues: { category: INQUIRY_CATEGORY.BUG_REPORT, content: '' },
    mode: 'onChange',
  });

  const onSubmit = (data: CreateInquiryInput) => {
    createInquiryMutation.mutate(data);
  };

  return (
    <View className="flex-1 bg-gray-1">
      <AnimatedScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <VStack gap={16}>
          <H3>문의 유형을 선택해주세요</H3>

          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <RadioGroup
                value={value}
                onValueChange={onChange}
                className="bg-white rounded-2xl overflow-hidden gap-0"
              >
                {Object.entries(INQUIRY_CATEGORY_LABELS).map(([key, label]) => (
                  <RadioGroup.Item key={key} value={key}>
                    {(_props) => (
                      <ListRow
                        contents={
                          <ListRow.Texts
                            type="1RowTypeA"
                            top={label}
                            topProps={{ size: 'b3', weight: 'semibold' }}
                          />
                        }
                        right={
                          <Radio>
                            <Radio.Indicator />
                          </Radio>
                        }
                        horizontalPadding="medium"
                        verticalPadding="large"
                      />
                    )}
                  </RadioGroup.Item>
                ))}
              </RadioGroup>
            )}
          />
        </VStack>

        <Spacing size={24} />

        <Controller
          control={control}
          name="content"
          render={({ field: { onChange, value } }) => (
            <VStack gap={4}>
              <TextArea
                label="문의 내용"
                placeholder={CONTENT_PLACEHOLDER}
                value={value}
                onChangeText={onChange}
                isInvalid={!!errors.content}
                errorMessage={errors.content?.message}
                maxLength={INQUIRY_CONTENT_LIMITS.MAX_LENGTH}
                className="min-h-40 bg-white border-gray-2"
              />
              <HStack justify="end" className="-mt-4">
                <Text size="e1" weight="medium" className="text-gray-5">
                  {value.length.toLocaleString()}/
                  {INQUIRY_CONTENT_LIMITS.MAX_LENGTH.toLocaleString()}
                </Text>
              </HStack>
            </VStack>
          )}
        />
      </AnimatedScrollView>

      <KeyboardAdaptiveButton
        onPress={handleSubmit(onSubmit)}
        isDisabled={!isValid}
        isLoading={createInquiryMutation.isPending}
      >
        문의 보내기
      </KeyboardAdaptiveButton>
    </View>
  );
};

export default InquiryScreen;
