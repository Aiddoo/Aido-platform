import { INQUIRY_CONTENT_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  FormStepLayout,
  HStack,
  IconRadioItem,
  KeyboardAdaptiveButton,
  Spacing,
  Text,
  TextArea,
  VStack,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useMutation } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { RadioGroup } from 'heroui-native';
import { Controller, useForm, useFormState } from 'react-hook-form';

import { INQUIRY_CATEGORY_LABEL_KEYS } from '../constants/inquiry-labels';
import { useCreateInquiryMutationOptions } from '../queries/inquiry.mutations';
import { inquiryFormSchema } from '../schemas/inquiry-form.schema';
import { inquiryParamsSchema } from '../schemas/inquiry-params.schema';

interface InquiryFormProps {
  title: string;
}

/** 문의 종류와 내용 입력, 키보드 위 보내기 버튼. 보내면 이전 화면으로 돌아간다 */
export function InquiryForm({ title }: InquiryFormProps) {
  const [initialValues] = useRouteParams(inquiryParamsSchema);
  const { t } = useTranslation('inquiry');
  const { locale } = useDateFormatContext();
  const navigation = useNavigation();
  const reportUnexpectedError = useReportUnexpectedError('inquiry');
  const goBack = useSingleTap(router.back);

  const createInquiry = useMutation(useCreateInquiryMutationOptions());
  const form = useForm({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });

  // 실패하면 토스트는 mutation이 한 번 알리고 화면과 입력값은 그대로 둔다
  const submitInquiry = form.handleSubmit(async (values) => {
    try {
      await createInquiry.mutateAsync(values);
      // 보내는 동안 이미 떠났다면 지금 화면이 이전 화면이므로 또 뒤로 가지 않는다
      if (navigation.isFocused()) {
        goBack();
      }
    } catch (error) {
      reportUnexpectedError(error);
    }
  });
  const handleSubmit = useSingleTap(() => submitInquiry());

  return (
    <>
      <FormStepLayout title={title}>
        <Controller
          control={form.control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <RadioGroup
              value={value}
              onValueChange={onChange}
              className="bg-gray-1 rounded-2xl overflow-hidden gap-0"
            >
              {Object.entries(INQUIRY_CATEGORY_LABEL_KEYS).map(([key, labelKey]) => (
                <IconRadioItem
                  key={key}
                  value={key}
                  label={tGlobal(labelKey)}
                  testID={`inquiry-category-${key}`}
                />
              ))}
            </RadioGroup>
          )}
        />

        <Spacing size={24} />

        <Controller
          control={form.control}
          name="content"
          render={({ field: { value, onChange, ref }, fieldState: { error } }) => (
            <VStack gap={4}>
              <TextArea
                ref={ref}
                testID="inquiry-content-input"
                label={t('form.contentLabel')}
                placeholder={t('form.contentPlaceholder')}
                value={value}
                onChange={onChange}
                isInvalid={error != null}
                errorMessage={resolveValidationMessage(error, {
                  default: 'inquiryContent.tooShort',
                  byType: { too_big: 'inquiryContent.tooLong' },
                })}
                maxLength={INQUIRY_CONTENT_LIMITS.MAX_LENGTH}
                className="min-h-40"
              />
              <HStack justify="end" className="-mt-4">
                <Text size="e1" weight="medium" className="text-gray-5">
                  {formatCount(value.length, locale)}/
                  {formatCount(INQUIRY_CONTENT_LIMITS.MAX_LENGTH, locale)}
                </Text>
              </HStack>
            </VStack>
          )}
        />
      </FormStepLayout>

      <KeyboardAdaptiveButton
        onPress={handleSubmit}
        isDisabled={!isValid}
        isLoading={isSubmitting}
        testID="inquiry-submit"
      >
        {t('form.submit')}
      </KeyboardAdaptiveButton>
    </>
  );
}
