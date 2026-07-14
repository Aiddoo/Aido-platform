import type { RegisterInput } from '@aido/validators';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, Button, HStack, Text, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, Checkbox, ControlField, Label, Separator } from 'heroui-native';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

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
  const { t } = useTranslation(['auth', 'common']);
  const { handleSubmit } = useFormContext<SignUpFormData>();
  const insets = useSafeAreaInsets();
  const openUrl = useOpenUrl();

  const [agreements, setAgreements] = useState(() => ({
    terms: false,
    privacy: false,
    marketing: false,
    marketingPush: false,
  }));

  const register = useMutation(useRegisterMutationOptions());

  const isAllAgreed = Object.values(agreements).every(Boolean);
  const isRequiredAgreed = agreements.terms && agreements.privacy;

  const toggleAll = () => {
    const newValue = !isAllAgreed;
    setAgreements({
      terms: newValue,
      privacy: newValue,
      marketing: newValue,
      marketingPush: newValue,
    });
  };

  const setAgreement = (key: keyof typeof agreements) => (isSelected: boolean) => {
    setAgreements((prev) => ({ ...prev, [key]: isSelected }));
  };

  const onSubmit = (data: SignUpFormData) => {
    const validatedData: RegisterInput = {
      ...data,
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: agreements.marketing,
      marketingPushAgreed: agreements.marketingPush,
    };

    register.mutate(validatedData, {
      onSuccess: () => {
        onOpenChange(false);
        onNextStep();
      },
      onError: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
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
                <TermsAgreementItem
                  label={t('terms.termsOfService')}
                  isRequired
                  isSelected={agreements.terms}
                  onSelectedChange={setAgreement('terms')}
                  onPressLink={() => openUrl(LEGAL_URLS.TERMS)}
                />
                <TermsAgreementItem
                  label={t('terms.marketingPush')}
                  isSelected={agreements.marketingPush}
                  onSelectedChange={setAgreement('marketingPush')}
                />
                <TermsAgreementItem
                  label={t('terms.privacyPolicy')}
                  isRequired
                  isSelected={agreements.privacy}
                  onSelectedChange={setAgreement('privacy')}
                  onPressLink={() => openUrl(LEGAL_URLS.PRIVACY)}
                />
                <TermsAgreementItem
                  label={t('terms.marketing')}
                  isSelected={agreements.marketing}
                  onSelectedChange={setAgreement('marketing')}
                />
              </VStack>
            </VStack>

            <Button
              color="dark"
              onPress={handleSubmit(onSubmit)}
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

interface TermsAgreementItemProps {
  label: string;
  isRequired?: boolean;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
  onPressLink?: () => void;
}

const TermsAgreementItem = ({
  label,
  isRequired = false,
  isSelected,
  onSelectedChange,
  onPressLink,
}: TermsAgreementItemProps) => {
  const { t } = useTranslation('auth');
  const requiredLabel = isRequired ? t('terms.required') : t('terms.optional');

  return (
    <ControlField isSelected={isSelected} onSelectedChange={onSelectedChange}>
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
