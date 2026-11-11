import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  ArrowRightIcon,
  BottomSheet,
  Button,
  H4,
  HStack,
  IconButton,
  Text,
  VStack,
  Checkbox,
} from '@src/shared/ui';
import { ControlField, Label, Separator } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Controller, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import type { SignUpFormValues } from '../schemas/sign-up-form.schema';

interface TermsAgreementBottomSheetProps extends Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'onOpenChange'
> {
  form: UseFormReturn<SignUpFormValues>;
  onOpenChange: (isOpen: boolean) => void;
  /** 폼과 mutation은 화면이 소유한다. 입력이 올바르지 않아 보내지 않았으면 false다 */
  onSubmit: () => Promise<boolean>;
}

/** 필수(이용약관·개인정보)와 선택(혜택·소식)을 묶음으로 나눈다. 모두 동의는 둘 다 켜고, 선택은 따로 끌 수 있다 */
export function TermsAgreementBottomSheet({
  form,
  onOpenChange,
  onSubmit,
  ...sheetProps
}: TermsAgreementBottomSheetProps) {
  const { t } = useTranslation('auth');
  const { isSubmitting, isValid } = useFormState({ control: form.control });
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();
  const [termsAgreed, privacyAgreed, isMarketingAgreed] = useWatch({
    control: form.control,
    name: ['termsAgreed', 'privacyAgreed', 'isMarketingAgreed'],
  });

  const setAllAgreed = (isSelected: boolean) => {
    form.setValue('termsAgreed', isSelected, { shouldDirty: true, shouldValidate: true });
    form.setValue('privacyAgreed', isSelected, { shouldDirty: true, shouldValidate: true });
    form.setValue('isMarketingAgreed', isSelected, { shouldDirty: true, shouldValidate: true });
  };

  const handleConfirm = async () => {
    const isSubmitted = await onSubmit();
    if (isSubmitted) {
      onOpenChange(false);
    }
  };

  return (
    <BottomSheet {...sheetProps} onOpenChange={onOpenChange}>
      <VStack gap={24}>
        <H4>{t('terms.title')}</H4>

        <VStack gap={16}>
          <ControlField
            isSelected={termsAgreed && privacyAgreed && isMarketingAgreed}
            onSelectedChange={setAllAgreed}
          >
            <ControlField.Indicator>
              <Checkbox />
            </ControlField.Indicator>
            <Label>
              <Text size="b2" weight="semibold">
                {t('terms.agreeAll')}
              </Text>
            </Label>
          </ControlField>

          <Separator />

          <VStack gap={20}>
            <Controller
              control={form.control}
              name="termsAgreed"
              render={({ field: { value, onChange } }) => (
                <TermsAgreementBottomSheet.Item
                  label={t('terms.termsOfService')}
                  isSelected={value}
                  onSelectedChange={onChange}
                  onPressLink={() => openUrl(getLegalUrl('terms', resolvedLanguage))}
                />
              )}
            />
            <Controller
              control={form.control}
              name="privacyAgreed"
              render={({ field: { value, onChange } }) => (
                <TermsAgreementBottomSheet.Item
                  label={t('terms.privacyPolicy')}
                  isSelected={value}
                  onSelectedChange={onChange}
                  onPressLink={() => openUrl(getLegalUrl('privacy', resolvedLanguage))}
                />
              )}
            />
          </VStack>

          <VStack gap={4}>
            <Controller
              control={form.control}
              name="isMarketingAgreed"
              render={({ field: { value, onChange } }) => (
                <TermsAgreementBottomSheet.Item
                  label={t('terms.marketing')}
                  isSelected={value}
                  onSelectedChange={onChange}
                />
              )}
            />
            <Text size="e1" shade={6} className="pl-7">
              {t('terms.marketingHint')}
            </Text>
          </VStack>
        </VStack>

        {/* 다른 칸은 앞 단계에서 이미 통과해 남은 판단은 필수 약관 두 개다 */}
        <Button onPress={handleConfirm} isLoading={isSubmitting} isDisabled={!isValid}>
          {t('terms.submit')}
        </Button>
      </VStack>
    </BottomSheet>
  );
}

interface TermsAgreementItemProps extends Omit<ComponentProps<typeof ControlField>, 'children'> {
  label: string;
  onPressLink?: () => void;
}

TermsAgreementBottomSheet.Item = function Item({
  label,
  onPressLink,
  ...props
}: TermsAgreementItemProps) {
  return (
    <ControlField {...props}>
      <ControlField.Indicator>
        <Checkbox />
      </ControlField.Indicator>
      <HStack flex={1} justify="between" align="center">
        <Label>
          <Text size="b4">{label}</Text>
        </Label>
        {onPressLink && (
          <IconButton
            accessibilityLabel={label}
            icon={<ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />}
            className="min-h-0 min-w-0"
            hitSlop={8}
            onPress={onPressLink}
          />
        )}
      </HStack>
    </ControlField>
  );
};
