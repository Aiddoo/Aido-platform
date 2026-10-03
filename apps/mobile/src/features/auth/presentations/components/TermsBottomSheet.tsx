import type { RegisterInput } from '@aido/validators';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { isBusinessError } from '@src/shared/errors/result';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, Button, HStack, Text, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, Checkbox, ControlField, Label, Separator } from 'heroui-native';
import type { ComponentProps } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useFormContext, useWatch } from 'react-hook-form';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRegisterMutationOptions } from '../queries/use-register-mutation-options';
import type { SignUpFormData } from '../schemas/sign-up-form.schema';

interface TermsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onNextStep: () => void;
}

export const TermsBottomSheet = ({ isOpen, onOpenChange, onNextStep }: TermsBottomSheetProps) => {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation(['auth', 'common']);
  const { control, handleSubmit, setValue } = useFormContext<SignUpFormData>();
  const insets = useSafeAreaInsets();
  const openUrl = useOpenUrl();

  const [termsAgreed, privacyAgreed, marketingAgreed, marketingPushAgreed] = useWatch({
    control,
    name: ['termsAgreed', 'privacyAgreed', 'marketingAgreed', 'marketingPushAgreed'],
  });
  const register = useMutation(useRegisterMutationOptions());
  const isAllAgreed = termsAgreed && privacyAgreed && marketingAgreed && marketingPushAgreed;
  const isRequiredAgreed = termsAgreed && privacyAgreed;

  const toggleAll = (isSelected: boolean) => {
    setValue('termsAgreed', isSelected, { shouldDirty: true });
    setValue('privacyAgreed', isSelected, { shouldDirty: true });
    setValue('marketingAgreed', isSelected, { shouldDirty: true });
    setValue('marketingPushAgreed', isSelected, { shouldDirty: true });
  };

  const onSubmit = async (data: SignUpFormData) => {
    if (!data.termsAgreed || !data.privacyAgreed) return;

    try {
      const validatedData: RegisterInput = {
        email: data.email,
        password: data.password,
        passwordConfirm: data.passwordConfirm,
        name: data.name,
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: data.marketingAgreed,
        marketingPushAgreed: data.marketingPushAgreed,
      };

      await register.mutateAsync(validatedData, {
        onSuccess: () => {
          onOpenChange(false);
          onNextStep();
        },
        onError: () => {
          onOpenChange(false);
        },
      });
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
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
          className="mx-4"
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
              onPress={() => handleSubmit(onSubmit)()}
              isLoading={register.isPending}
              isDisabled={!isRequiredAgreed}
            >
              {t('common:actions.confirm')}
            </Button>
          </VStack>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

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
