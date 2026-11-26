import { INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateInquiryMutationOptions } from '@src/features/support/inquiry/queries/inquiry.mutations';
import { inquiryFormSchema } from '@src/features/support/inquiry/schemas/inquiry-form.schema';
import { inquiryParamsSchema } from '@src/features/support/inquiry/schemas/inquiry-params.schema';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  FormStepLayout,
  KeyboardAdaptiveButton,
  ReadableContent,
  SettingsListGroup,
  Spacing,
  Text,
  TextArea,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Stack, useNavigation } from 'expo-router';
import { RadioGroup } from 'heroui-native';
import { Controller, FormState, useForm } from 'react-hook-form';

export default function InquiryScreen() {
  const { t } = useTranslation(['inquiry', 'settings']);
  const { locale } = useDateFormatContext();
  const [initialValues] = useRouteParams(inquiryParamsSchema);
  const navigation = useNavigation();
  const goBack = useGoBack({ fallbackHref: '/mypage' });
  const createInquiry = useMutation(useCreateInquiryMutationOptions());
  // 칸과 버튼이 그 조각만 구독해 글자를 쳐도 화면은 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  // 실패는 여기서 받지 않는다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 보낼 수 있다
  const submitInquiry = form.handleSubmit(async (values) => {
    await createInquiry.mutateAsync(values);
    // 떠난 사이 접수됐으면 이전 화면을 또 닫지 않고, 돌아와 같은 글을 또 보내지 않게 내용만 비운다
    if (!navigation.isFocused()) {
      form.reset({ category: values.category, content: '' });
      return;
    }
    goBack();
  });
  // 실패하면 토스트는 mutation의 meta.errorFeedback이 한 번 알리고 화면과 입력값은 그대로 둔다
  const handleSendPress = useSingleTap(() => {
    submitInquiry().catch(noop);
  });

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.inquiry') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <FormStepLayout
            title={t('form.selectCategory')}
            footer={
              <FormState
                control={form.control}
                render={({ isValid, isSubmitting, isSubmitSuccessful }) => (
                  <KeyboardAdaptiveButton
                    onPress={handleSendPress}
                    isDisabled={!isValid}
                    // 보내면 화면이 내려가는 동안에도 같은 글이 남는다. 그동안 다시 보내지 않는다
                    isLoading={isSubmitting || isSubmitSuccessful}
                    testID="inquiry-submit"
                  >
                    {t('form.submit')}
                  </KeyboardAdaptiveButton>
                )}
              />
            }
          >
            <Controller
              control={form.control}
              name="category"
              render={({ field: { value, onChange } }) => (
                <SettingsListGroup>
                  <RadioGroup value={value} onValueChange={onChange} className="gap-0">
                    <SettingsListGroup.Radio
                      value={INQUIRY_CATEGORY.BUG_REPORT}
                      label={t('category.bugReport')}
                      testID={`inquiry-category-${INQUIRY_CATEGORY.BUG_REPORT}`}
                    />
                    <SettingsListGroup.Radio
                      value={INQUIRY_CATEGORY.FEATURE_REQUEST}
                      label={t('category.featureRequest')}
                      testID={`inquiry-category-${INQUIRY_CATEGORY.FEATURE_REQUEST}`}
                    />
                    <SettingsListGroup.Radio
                      value={INQUIRY_CATEGORY.PAYMENT}
                      label={t('category.payment')}
                      testID={`inquiry-category-${INQUIRY_CATEGORY.PAYMENT}`}
                    />
                    <SettingsListGroup.Radio
                      value={INQUIRY_CATEGORY.OTHER}
                      label={t('category.other')}
                      testID={`inquiry-category-${INQUIRY_CATEGORY.OTHER}`}
                    />
                  </RadioGroup>
                </SettingsListGroup>
              )}
            />

            <Spacing size={24} />

            <Controller
              control={form.control}
              name="content"
              render={({ field: { value, onChange, ref }, fieldState: { error } }) => (
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
                  counter={
                    <Text size="e1" weight="medium" className="text-gray-5">
                      {formatCount(value.length, locale)}/
                      {formatCount(INQUIRY_CONTENT_LIMITS.MAX_LENGTH, locale)}
                    </Text>
                  }
                  maxLength={INQUIRY_CONTENT_LIMITS.MAX_LENGTH}
                  className="min-h-40"
                />
              )}
            />
          </FormStepLayout>
        </ReadableContent>
      </Box>
    </>
  );
}
