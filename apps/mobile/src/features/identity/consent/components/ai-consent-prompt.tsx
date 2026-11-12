import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  Box,
  Button,
  CheckmarkIcon,
  H4,
  HStack,
  RobotIcon,
  SendIcon,
  Text,
  TextButton,
  VStack,
  WordWrapText,
  Mascot,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useUpdateAiDataSharingConsentMutationOptions } from '../queries/consent.mutations';

const ITEM_ICON_SIZE = 16;
const PRIVACY_LINK_MIN_HEIGHT = 44;

interface AiConsentPromptProps {
  /** 이전 안내에 동의한 사람에게 바뀐 내용을 다시 알린다. 답하지 않아도 이전 동의는 그대로다 */
  isRenewal?: boolean;
}

/** AI 데이터 제공 안내 시트의 내용. 버튼은 시트 아래에 고정되는 `AiConsentPrompt.Actions`다 */
export function AiConsentPrompt({ isRenewal = false }: AiConsentPromptProps) {
  const { t } = useTranslation('ai');
  const fontScaledSize = useFontScaledSize();
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();

  return (
    <VStack gap={20} testID="ai-consent-sheet">
      <VStack gap={12} align="center">
        <Mascot name="catSuggestion" size={72} />
        <VStack gap={6} align="center">
          <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {t('consent.title')}
          </H4>
          <Text size="b3" shade={7} align="center">
            {isRenewal ? t('consent.renewal.subtitle') : t('consent.subtitle')}
          </Text>
        </VStack>
      </VStack>

      <VStack gap={14}>
        <ConsentItem
          icon={
            <SendIcon
              width={fontScaledSize(ITEM_ICON_SIZE)}
              height={fontScaledSize(ITEM_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
          title={t('consent.items.sentData.title')}
          description={t('consent.items.sentData.description')}
        />
        <ConsentItem
          icon={
            <RobotIcon
              width={fontScaledSize(ITEM_ICON_SIZE)}
              height={fontScaledSize(ITEM_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
          title={t('consent.items.processor.title')}
          description={t('consent.items.processor.description')}
        />
        <ConsentItem
          icon={
            <CheckmarkIcon
              width={fontScaledSize(ITEM_ICON_SIZE)}
              height={fontScaledSize(ITEM_ICON_SIZE)}
              colorClassName="text-main"
            />
          }
          title={t('consent.items.usage.title')}
          description={t('consent.items.usage.description')}
        />
      </VStack>

      <TextButton
        size="medium"
        variant="underline"
        accessibilityRole="link"
        style={{ minHeight: PRIVACY_LINK_MIN_HEIGHT }}
        className="self-center justify-center"
        onPress={() => openUrl(getLegalUrl('privacy', resolvedLanguage, 'overseas-transfer'))}
      >
        {t('consent.privacyLink')}
      </TextButton>

      <Text size="e1" shade={6} align="center">
        {isRenewal ? t('consent.renewal.declineNotice') : t('consent.declineNotice')}
      </Text>
    </VStack>
  );
}

interface AiConsentPromptActionsProps {
  /** 동의를 저장한 뒤 불린다. 시트를 닫고 원래 하려던 AI 동작을 잇는다 */
  onAgree: () => void;
  onLater: () => void;
}

/** 동의 저장은 버튼이 맡고, 실패하면 토스트로 알리고 시트를 그대로 둔다 */
AiConsentPrompt.Actions = function Actions({ onAgree, onLater }: AiConsentPromptActionsProps) {
  const { t } = useTranslation('ai');
  const { fontScale } = useFontScale();
  const updateConsent = useMutation(useUpdateAiDataSharingConsentMutationOptions());

  const later = (
    <Button
      variant="weak"
      color="dark"
      size="large"
      display="full"
      onPress={onLater}
      isDisabled={updateConsent.isPending}
      testID="ai-consent-later"
    >
      {t('consent.later')}
    </Button>
  );
  const agree = (
    <Button
      color="primary"
      size="large"
      display="full"
      onPress={() => updateConsent.mutate({ agreed: true }, { onSuccess: () => onAgree() })}
      isLoading={updateConsent.isPending}
      testID="ai-consent-agree"
    >
      {t('consent.agree')}
    </Button>
  );

  // 가장 큰 글자 크기에서는 두 버튼을 나란히 두면 라벨이 잘려 세로로 쌓고 동의를 위에 둔다
  if (fontScale === 'xlarge') {
    return (
      <VStack gap={8}>
        {agree}
        {later}
      </VStack>
    );
  }

  return (
    <HStack gap={8}>
      <Box className="flex-1">{later}</Box>
      <Box className="flex-1">{agree}</Box>
    </HStack>
  );
};

interface ConsentItemProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function ConsentItem({ icon, title, description }: ConsentItemProps) {
  return (
    <HStack gap={12} align="start">
      <Box className="size-7 items-center justify-center rounded-full bg-main/10">{icon}</Box>
      <VStack gap={2} className="flex-1">
        <Text size="b3" weight="semibold" shade={9}>
          {title}
        </Text>
        <WordWrapText size="b4" shade={7}>
          {description}
        </WordWrapText>
      </VStack>
    </HStack>
  );
}
