import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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
  getTouchTargetInset,
} from '@src/shared/ui';
import { ControlField, Label, Separator } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { SignUpFormValues } from '../schemas/sign-up-form.schema';

type TermsAgreement = Pick<SignUpFormValues, 'termsAgreed' | 'privacyAgreed' | 'isMarketingAgreed'>;

/** 약관 보기 화살표 칸(size-4) */
const LINK_BUTTON_SIZE = 16;
/** 두 약관 줄의 화살표는 위아래로 24 떨어져 있어 반씩만 넓혀 서로 겹치지 않게 한다 */
const LINK_HIT_SLOP = {
  top: 12,
  bottom: 12,
  left: getTouchTargetInset(LINK_BUTTON_SIZE),
  right: getTouchTargetInset(LINK_BUTTON_SIZE),
};

interface TermsAgreementBottomSheetProps extends Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'onOpenChange'
> {
  value: TermsAgreement;
  onChange: (value: TermsAgreement) => void;
  onOpenChange: (isOpen: boolean) => void;
  /** 다른 칸은 앞 단계에서 이미 통과해 남은 판단은 필수 약관 두 개다 */
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  /** 폼과 mutation은 화면이 소유한다. 가입하면 화면이 인증 단계로 넘어가 시트가 함께 내려간다 */
  onSubmit: () => void;
}

/** 필수(이용약관·개인정보)와 선택(혜택·소식)을 묶음으로 나눈다. 모두 동의는 둘 다 켜고, 선택은 따로 끌 수 있다 */
export function TermsAgreementBottomSheet({
  value,
  onChange,
  onOpenChange,
  isSubmitDisabled,
  isSubmitting,
  onSubmit,
  ...sheetProps
}: TermsAgreementBottomSheetProps) {
  const { t } = useTranslation('auth');
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();
  const { termsAgreed, privacyAgreed, isMarketingAgreed } = value;

  const setAllAgreed = (isSelected: boolean) => {
    onChange({ termsAgreed: isSelected, privacyAgreed: isSelected, isMarketingAgreed: isSelected });
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
            <TermsAgreementBottomSheet.Item
              label={t('terms.termsOfService')}
              isSelected={termsAgreed}
              onSelectedChange={(isSelected) => onChange({ ...value, termsAgreed: isSelected })}
              onPressLink={() => openUrl(getLegalUrl('terms', resolvedLanguage))}
            />
            <TermsAgreementBottomSheet.Item
              label={t('terms.privacyPolicy')}
              isSelected={privacyAgreed}
              onSelectedChange={(isSelected) => onChange({ ...value, privacyAgreed: isSelected })}
              onPressLink={() => openUrl(getLegalUrl('privacy', resolvedLanguage))}
            />
          </VStack>

          <VStack gap={4}>
            <TermsAgreementBottomSheet.Item
              label={t('terms.marketing')}
              isSelected={isMarketingAgreed}
              onSelectedChange={(isSelected) =>
                onChange({ ...value, isMarketingAgreed: isSelected })
              }
            />
            <Text size="e1" shade={6} className="pl-7">
              {t('terms.marketingHint')}
            </Text>
          </VStack>
        </VStack>

        <Button onPress={onSubmit} isLoading={isSubmitting} isDisabled={isSubmitDisabled}>
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
  const fontScaledSize = useFontScaledSize();

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
            icon={
              <ArrowRightIcon
                width={fontScaledSize(16)}
                height={fontScaledSize(16)}
                colorClassName="text-gray-5"
              />
            }
            className="size-4 min-h-0 min-w-0"
            hitSlop={LINK_HIT_SLOP}
            onPress={onPressLink}
          />
        )}
      </HStack>
    </ControlField>
  );
};
