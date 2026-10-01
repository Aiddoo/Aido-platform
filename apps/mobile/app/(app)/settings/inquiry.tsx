import {
  type CreateInquiryInput,
  createInquirySchema,
  INQUIRY_CATEGORY,
  INQUIRY_CONTENT_LIMITS,
} from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { INQUIRY_CATEGORY_LABEL_KEYS } from '@src/features/inquiry/presentations/constants/inquiry-category-labels.constant';
import { useCreateInquiryMutationOptions } from '@src/features/inquiry/presentations/queries/use-create-inquiry-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
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
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { Radio, RadioGroup } from 'heroui-native';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { scrollTo, useAnimatedRef, useSharedValue } from 'react-native-reanimated';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const InquiryScreen = () => {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation('inquiry');
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const contentHeight = useSharedValue(0);
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
        scrollTo(scrollViewRef, 0, contentHeight.value, true);
      }
    },
  });

  const formMethods = useForm({
    resolver: zodResolver(createInquirySchema),
    defaultValues: { category: INQUIRY_CATEGORY.BUG_REPORT, content: '' },
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const onSubmit = async (data: CreateInquiryInput) => {
    try {
      await createInquiryMutation.mutateAsync(data);
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  };

  return (
    <FormProvider {...formMethods}>
      <View className="flex-1 bg-gray-1">
        <AnimatedScrollView
          ref={scrollViewRef}
          onContentSizeChange={(_w, h) => {
            contentHeight.value = h;
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <VStack gap={16}>
            <H3>{t('form.selectCategory')}</H3>

            <FormField control={control} name="category">
              {({ onChange, value }) => (
                <RadioGroup
                  value={value}
                  onValueChange={onChange}
                  className="bg-white rounded-2xl overflow-hidden gap-0"
                >
                  {Object.entries(INQUIRY_CATEGORY_LABEL_KEYS).map(([key, labelKey]) => (
                    <RadioGroup.Item key={key} value={key}>
                      {(_props) => (
                        <ListRow
                          contents={
                            <ListRow.Texts
                              type="1RowTypeA"
                              top={tGlobal(labelKey)}
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
            </FormField>
          </VStack>

          <Spacing size={24} />

          <FormField control={control} name="content">
            {({ onChange, value }, { error }) => (
              <VStack gap={4}>
                <TextArea
                  label={t('form.contentLabel')}
                  placeholder={t('form.contentPlaceholder')}
                  value={value}
                  onChange={onChange}
                  isInvalid={!!error}
                  errorMessage={resolveValidationMessage(error, {
                    default: 'inquiryContent.tooShort',
                    byType: { too_big: 'inquiryContent.tooLong' },
                  })}
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
          </FormField>
        </AnimatedScrollView>

        <KeyboardAdaptiveButton
          onPress={() => handleSubmit(onSubmit)()}
          isDisabled={!isValid}
          isLoading={isSubmitting}
        >
          {t('form.submit')}
        </KeyboardAdaptiveButton>
      </View>
    </FormProvider>
  );
};

export default InquiryScreen;
