import type { RegisterInput } from '@aido/validators';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
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
  const { handleSubmit } = useFormContext<SignUpFormData>();
  const insets = useSafeAreaInsets();
  const openUrl = useOpenUrl();

  const [agreements, setAgreements] = useState(() => ({
    terms: false,
    privacy: false,
    marketing: false,
  }));

  const register = useMutation(useRegisterMutationOptions());

  const isAllAgreed = agreements.terms && agreements.privacy && agreements.marketing;
  const isRequiredAgreed = agreements.terms && agreements.privacy;

  const toggleAll = () => {
    const newValue = !isAllAgreed;
    setAgreements({ terms: newValue, privacy: newValue, marketing: newValue });
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
          backgroundClassName="rounded-[24px]"
        >
          <VStack gap={32}>
            <VStack gap={16}>
              <ControlField isSelected={isAllAgreed} onSelectedChange={toggleAll}>
                <ControlField.Indicator>
                  <Checkbox className="shadow-none border border-main size-5 rounded-md" />
                </ControlField.Indicator>
                <Label>
                  <Text size="b2" weight="semibold">
                    약관에 모두 동의
                  </Text>
                </Label>
              </ControlField>

              <Separator />

              <VStack gap={20}>
                <TermsAgreementItem
                  label="서비스 이용약관 동의"
                  isRequired
                  isSelected={agreements.terms}
                  onSelectedChange={setAgreement('terms')}
                  onPressLink={() => openUrl(LEGAL_URLS.TERMS)}
                />
                <TermsAgreementItem
                  label="개인정보처리방침 동의"
                  isRequired
                  isSelected={agreements.privacy}
                  onSelectedChange={setAgreement('privacy')}
                  onPressLink={() => openUrl(LEGAL_URLS.PRIVACY)}
                />
                <TermsAgreementItem
                  label="마케팅 정보 수신 동의"
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
              확인
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
  const requiredLabel = isRequired ? '필수' : '선택';

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
