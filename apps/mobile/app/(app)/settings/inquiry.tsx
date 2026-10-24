import {
  type CreateInquiryInput,
  createInquirySchema,
  INQUIRY_CATEGORY,
  INQUIRY_CONTENT_LIMITS,
} from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { INQUIRY_CATEGORY_LABEL_KEYS } from '@src/features/inquiry/constants/inquiry-category-labels';
import { useCreateInquiryMutationOptions } from '@src/features/inquiry/queries/use-create-inquiry-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  H3,
  HStack,
  IconRadioItem,
  KeyboardAdaptiveButton,
  Spacing,
  Text,
  TextArea,
  VStack,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Box,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { getDateFormatContext } from '@src/shared/utils/date';
import { formatCount } from '@src/shared/utils/format';
import { useMutation } from '@tanstack/react-query';
import { RadioGroup } from 'heroui-native';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, { scrollTo, useAnimatedRef, useSharedValue } from 'react-native-reanimated';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function InquiryScreen() {
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
    onMove: (event) => {
      'worklet';
      if (event.height > 0 && !hasScrolled.value) {
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

  const handleSubmitInquiry = async (values: CreateInquiryInput) => {
    try {
      await createInquiryMutation.mutateAsync(values);
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <Box className="flex-1 bg-gray-1">
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
          <StyledSafeAreaView edges={['left', 'right']}>
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
                      <IconRadioItem key={key} value={key} label={tGlobal(labelKey)} />
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
                      {formatCount(value.length, getDateFormatContext().locale)}/
                      {formatCount(
                        INQUIRY_CONTENT_LIMITS.MAX_LENGTH,
                        getDateFormatContext().locale,
                      )}
                    </Text>
                  </HStack>
                </VStack>
              )}
            </FormField>
          </StyledSafeAreaView>
        </AnimatedScrollView>

        <KeyboardAdaptiveButton
          onPress={() => handleSubmit(handleSubmitInquiry)()}
          isDisabled={!isValid}
          isLoading={isSubmitting}
        >
          {t('form.submit')}
        </KeyboardAdaptiveButton>
      </Box>
    </FormProvider>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function InquiryRoute() {
  return (
    <QueryErrorBoundary>
      <InquiryScreen />
    </QueryErrorBoundary>
  );
}
