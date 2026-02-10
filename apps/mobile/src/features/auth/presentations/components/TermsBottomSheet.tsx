import type { RegisterInput } from '@aido/validators';
import { registerMutationOptions } from '@src/features/auth/presentations/queries/register-mutation-options';
import type { SignUpFormData } from '@src/features/auth/presentations/schemas/sign-up-form.schema';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon } from '@src/shared/ui/Icon';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, Checkbox, Divider, FormField } from 'heroui-native';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TermsBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onNextStep: () => void;
}

export const TermsBottomSheet = ({ isOpen, onOpenChange, onNextStep }: TermsBottomSheetProps) => {
  const { handleSubmit } = useFormContext<SignUpFormData>();
  const insets = useSafeAreaInsets();

  const [agreements, setAgreements] = useState(() => ({
    terms: false,
    privacy: false,
    marketing: false,
  }));

  const register = useMutation(registerMutationOptions());

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
          bottomInset={insets.bottom}
          className="mx-4"
          backgroundClassName="rounded-[24px]"
        >
          <VStack gap={32}>
            <VStack gap={16}>
              <FormField isSelected={isAllAgreed} onSelectedChange={toggleAll}>
                <FormField.Indicator>
                  <Checkbox />
                </FormField.Indicator>
                <FormField.Label>
                  <Text size="b2" weight="semibold">
                    약관에 모두 동의
                  </Text>
                </FormField.Label>
              </FormField>

              <Divider />

              <VStack gap={20}>
                <TermsAgreementItem
                  label="서비스 이용약관 동의"
                  isRequired
                  isSelected={agreements.terms}
                  onSelectedChange={setAgreement('terms')}
                />
                <TermsAgreementItem
                  label="개인정보처리방침 동의"
                  isRequired
                  isSelected={agreements.privacy}
                  onSelectedChange={setAgreement('privacy')}
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
    <FormField isSelected={isSelected} onSelectedChange={onSelectedChange}>
      <FormField.Indicator>
        <Checkbox />
      </FormField.Indicator>
      <HStack flex={1} justify="between" align="center">
        <FormField.Label>
          <HStack gap={4} align="center">
            <Text size="b4">{label}</Text>
            <Text size="b4" shade={6}>
              ({requiredLabel})
            </Text>
          </HStack>
        </FormField.Label>
        {onPressLink && (
          <Pressable hitSlop={8} onPress={onPressLink}>
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />
          </Pressable>
        )}
      </HStack>
    </FormField>
  );
};
