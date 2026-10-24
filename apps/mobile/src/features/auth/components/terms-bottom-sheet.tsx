import { LEGAL_URLS } from '@src/shared/constants/legal-urls';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Button,
  HStack,
  Text,
  VStack,
  SHEET_DETACHED_MARGIN,
  useSheetLayout,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { BottomSheet, Checkbox, ControlField, Label, Separator } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SignUpFormInput } from '../domains/sign-up-form.schema';

interface TermsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 동의 확인 시 호출하는 회원가입 제출 함수. 폼과 mutation은 화면이 소유한다. */
  onSubmit: () => Promise<unknown>;
}

export function TermsBottomSheet({ isOpen, onOpenChange, onSubmit }: TermsBottomSheetProps) {
  const { t } = useTranslation(['auth', 'common']);
  const { control, setValue } = useFormContext<SignUpFormInput>();
  const { isSubmitting } = useFormState({ control });
  const insets = useSafeAreaInsets();
  const sheetLayout = useSheetLayout({ minMargin: SHEET_DETACHED_MARGIN, isFullWindowHost: true });
  const openUrl = useOpenUrl();

  const [termsAgreed, privacyAgreed, marketingAgreed, marketingPushAgreed] = useWatch({
    control,
    name: ['termsAgreed', 'privacyAgreed', 'marketingAgreed', 'marketingPushAgreed'],
  });
  const isAllAgreed = termsAgreed && privacyAgreed && marketingAgreed && marketingPushAgreed;
  const isRequiredAgreed = termsAgreed && privacyAgreed;

  const toggleAll = (isSelected: boolean) => {
    setValue('termsAgreed', isSelected, { shouldDirty: true });
    setValue('privacyAgreed', isSelected, { shouldDirty: true });
    setValue('marketingAgreed', isSelected, { shouldDirty: true });
    setValue('marketingPushAgreed', isSelected, { shouldDirty: true });
  };

  const handleConfirm = async () => {
    await onSubmit();
    onOpenChange(false);
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          accessible={false}
          enableDynamicSizing
          detached
          bottomInset={insets.bottom || 16}
          topInset={sheetLayout.topInset}
          style={{ marginLeft: sheetLayout.margins.left, marginRight: sheetLayout.margins.right }}
          backgroundClassName="rounded-[32px]"
        >
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
                <FormField control={control} name="termsAgreed">
                  {({ value, onChange }) => (
                    <TermsBottomSheet.AgreementItem
                      label={t('terms.termsOfService')}
                      isRequired
                      isSelected={value}
                      onSelectedChange={onChange}
                      onPressLink={() => openUrl(LEGAL_URLS.TERMS)}
                    />
                  )}
                </FormField>
                <FormField control={control} name="marketingPushAgreed">
                  {({ value, onChange }) => (
                    <TermsBottomSheet.AgreementItem
                      label={t('terms.marketingPush')}
                      isSelected={value}
                      onSelectedChange={onChange}
                    />
                  )}
                </FormField>
                <FormField control={control} name="privacyAgreed">
                  {({ value, onChange }) => (
                    <TermsBottomSheet.AgreementItem
                      label={t('terms.privacyPolicy')}
                      isRequired
                      isSelected={value}
                      onSelectedChange={onChange}
                      onPressLink={() => openUrl(LEGAL_URLS.PRIVACY)}
                    />
                  )}
                </FormField>
                <FormField control={control} name="marketingAgreed">
                  {({ value, onChange }) => (
                    <TermsBottomSheet.AgreementItem
                      label={t('terms.marketing')}
                      isSelected={value}
                      onSelectedChange={onChange}
                    />
                  )}
                </FormField>
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
        </BottomSheet.Content>
      </BottomSheet.Portal>
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
          <Pressable hitSlop={8} onPress={onPressLink}>
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />
          </Pressable>
        )}
      </HStack>
    </ControlField>
  );
};
