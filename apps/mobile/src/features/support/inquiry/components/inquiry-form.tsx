import { INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  FormStepLayout,
  KeyboardAdaptiveButton,
  SettingsListGroup,
  Spacing,
  Text,
  TextArea,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { router, useNavigation } from 'expo-router';
import { RadioGroup } from 'heroui-native';
import { Controller, useForm, useFormState } from 'react-hook-form';

import { useCreateInquiryMutationOptions } from '../queries/inquiry.mutations';
import { inquiryFormSchema } from '../schemas/inquiry-form.schema';
import { inquiryParamsSchema } from '../schemas/inquiry-params.schema';

interface InquiryFormProps {
  title: string;
}

export function InquiryForm({ title }: InquiryFormProps) {
  const [initialValues] = useRouteParams(inquiryParamsSchema);
  const { t } = useTranslation('inquiry');
  const { locale } = useDateFormatContext();
  const navigation = useNavigation();
  const goBack = useSingleTap(router.back);

  const createInquiry = useMutation(useCreateInquiryMutationOptions());
  const form = useForm({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });
  const { isSubmitting, isSubmitSuccessful, isValid } = useFormState({ control: form.control });
  // 보내면 화면이 내려가는 동안에도 같은 글이 남는다. 그동안 다시 보내지 않는다
  const isSubmitLocked = isSubmitting || isSubmitSuccessful;

  // 실패는 여기서 받지 않는다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 보낼 수 있다
  const saveInquiry = form.handleSubmit(async (values) => {
    await createInquiry.mutateAsync(values);
    // 보내는 동안 이미 떠났다면 지금 화면이 이전 화면이므로 또 뒤로 가지 않는다
    if (navigation.isFocused()) {
      goBack();
    }
  });
  // 실패하면 토스트는 mutation의 meta.errorFeedback이 한 번 알리고 화면과 입력값은 그대로 둔다
  const handleSavePress = useSingleTap(() => saveInquiry().catch(noop));

  return (
    <FormStepLayout
      title={title}
      footer={
        <KeyboardAdaptiveButton
          onPress={handleSavePress}
          isDisabled={!isValid}
          isLoading={isSubmitLocked}
          testID="inquiry-submit"
        >
          {t('form.submit')}
        </KeyboardAdaptiveButton>
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
  );
}
