import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  ArrowRightIcon,
  BottomSheet,
  Button,
  HStack,
  Text,
  VStack,
  IconButton,
} from '@src/shared/ui';
import { Checkbox, ControlField, Label, Separator } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Controller, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import type { SignUpFormInput } from '../schemas/sign-up-form.schema';

interface TermsBottomSheetProps {
  form: UseFormReturn<SignUpFormInput>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 동의 확인 시 호출하는 회원가입 제출 함수. 폼과 mutation은 화면이 소유한다. */
  onSubmit: () => Promise<unknown>;
}

export function TermsBottomSheet({ form, isOpen, onOpenChange, onSubmit }: TermsBottomSheetProps) {
  const { t } = useTranslation(['auth', 'common']);
  const { isSubmitting } = useFormState({ control: form.control });
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();

  const [termsAgreed, privacyAgreed, marketingAgreed, marketingPushAgreed] = useWatch({
    control: form.control,
    name: ['termsAgreed', 'privacyAgreed', 'marketingAgreed', 'marketingPushAgreed'],
  });
  const isAllAgreed = termsAgreed && privacyAgreed && marketingAgreed && marketingPushAgreed;
  const isRequiredAgreed = termsAgreed && privacyAgreed;

  const toggleAll = (isSelected: boolean) => {
    form.setValue('termsAgreed', isSelected, { shouldDirty: true });
    form.setValue('privacyAgreed', isSelected, { shouldDirty: true });
    form.setValue('marketingAgreed', isSelected, { shouldDirty: true });
    form.setValue('marketingPushAgreed', isSelected, { shouldDirty: true });
  };

  const handleConfirm = async () => {
    await onSubmit();
    onOpenChange(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={32}>
        <VStack gap={16}>
          <ControlField isSelected={isAllAgreed} onSelectedChange={toggleAll}>
            <ControlField.Indicator>
              <Checkbox className="shadow-none border border-main size-5 rounded-md" />
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
                <TermsBottomSheet.AgreementItem
                  label={t('terms.termsOfService')}
                  isRequired
                  isSelected={value}
                  onSelectedChange={onChange}
                  onPressLink={() => openUrl(getLegalUrl('terms', resolvedLanguage))}
                />
              )}
            />
            <Controller
              control={form.control}
              name="marketingPushAgreed"
              render={({ field: { value, onChange } }) => (
                <TermsBottomSheet.AgreementItem
                  label={t('terms.marketingPush')}
                  isSelected={value}
                  onSelectedChange={onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="privacyAgreed"
              render={({ field: { value, onChange } }) => (
                <TermsBottomSheet.AgreementItem
                  label={t('terms.privacyPolicy')}
                  isRequired
                  isSelected={value}
                  onSelectedChange={onChange}
                  onPressLink={() => openUrl(getLegalUrl('privacy', resolvedLanguage))}
                />
              )}
            />
            <Controller
              control={form.control}
              name="marketingAgreed"
              render={({ field: { value, onChange } }) => (
                <TermsBottomSheet.AgreementItem
                  label={t('terms.marketing')}
                  isSelected={value}
                  onSelectedChange={onChange}
                />
              )}
            />
          </VStack>
        </VStack>

        <Button
          color="dark"
          onPress={handleConfirm}
          isLoading={isSubmitting}
          isDisabled={!isRequiredAgreed}
        >
          {t('common:actions.confirm')}
        </Button>
      </VStack>
    </BottomSheet>
  );
}

interface TermsAgreementItemProps extends Omit<ComponentProps<typeof ControlField>, 'children'> {
  label: string;
  isRequired?: boolean;
  onPressLink?: () => void;
}

TermsBottomSheet.AgreementItem = function AgreementItem({
  label,
  isRequired = false,
  onPressLink,
  ...props
}: TermsAgreementItemProps) {
  const { t } = useTranslation('auth');
  const requiredLabel = isRequired ? t('terms.required') : t('terms.optional');

  return (
    <ControlField {...props}>
      <ControlField.Indicator>
        <Checkbox className="shadow-none border border-main size-5 rounded-md" />
      </ControlField.Indicator>
      <HStack flex={1} justify="between" align="center">
        <Label>
          <HStack gap={4} align="center">
            <Text size="b4">{label}</Text>
            <Text size="b4" shade={6}>
              ({requiredLabel})
            </Text>
          </HStack>
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
